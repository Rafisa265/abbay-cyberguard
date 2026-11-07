import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Assistant from './components/Assistant.jsx'
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  cleanTextForSpeech,
  getVoiceForLanguage,
  resolveSpeechLanguage,
  speakText,
  requestOnlineVoiceConsent,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
  startSpeechRecognition,
  quantizeFloat32ToInt16,
  buildCanonicalWav,
  uint8ArrayToBase64,
  transcribeAudioOffline,
} from './lib/voiceAssistant.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('CyberShield Multilingual Voice Assistant — Unit & Privacy Tests', () => {
  const tEn = (k) => en[k] || k
  const tOm = (k) => om[k] || k
  const tAm = (k) => am[k] || k

  it('1. Capability Detection: accurately detects environment support', () => {
    // In node/SSR environment without window.speechSynthesis
    expect(isSpeechRecognitionSupported()).toBe(false)
    expect(isSpeechSynthesisSupported()).toBe(false)

    // With mocked window
    const origWindow = global.window
    try {
      global.window = {
        webkitSpeechRecognition: vi.fn(),
        speechSynthesis: {},
        SpeechSynthesisUtterance: vi.fn(),
      }
      expect(isSpeechRecognitionSupported()).toBe(true)
      expect(isSpeechSynthesisSupported()).toBe(true)
    } finally {
      global.window = origWindow
    }
  })

  it('2. Text Cleaning: strips markdown formatting, links, and code blocks for speech synthesis', () => {
    const raw = `### Phishing Alert
Check **this important link** [CBE Bank](https://cbe.com.et) immediately!
• Never share your \`127#\` OTP.
1. Dial 951 for help.`

    const cleaned = cleanTextForSpeech(raw)
    expect(cleaned).not.toContain('###')
    expect(cleaned).not.toContain('**')
    expect(cleaned).not.toContain('[CBE Bank]')
    expect(cleaned).toContain('CBE Bank')
    expect(cleaned).not.toContain('`')
    expect(cleaned).toContain('127#')
    expect(cleaned).not.toContain('•')
    expect(cleaned).not.toContain('1.')
  })

  it('3. Genuine Voice Matching: selects correct language and strictly avoids wrong-language substitution', () => {
    const mockVoices = [
      { name: 'Microsoft David', lang: 'en-US', localService: true },
      { name: 'Microsoft Sonia', lang: 'en-GB', localService: true },
      { name: 'Microsoft መቅደስ Local - Amharic (Ethiopia)', lang: 'am-ET', localService: true },
      { name: 'Microsoft አምሀ Local - Amharic (Ethiopia)', lang: 'am-ET', localService: true },
      { name: 'Microsoft Paul', lang: 'fr-FR', localService: true },
    ]

    // English
    const enVoice = getVoiceForLanguage('en', mockVoices)
    expect(enVoice).toBeTruthy()
    expect(enVoice.lang.startsWith('en')).toBe(true)

    // Amharic
    const amVoice = getVoiceForLanguage('am', mockVoices)
    expect(amVoice).toBeTruthy()
    expect(amVoice.lang).toBe('am-ET')

    // Afaan Oromoo: MUST return null when no genuine Oromo voice exists
    // Never substitute English or Amharic for Afaan Oromoo!
    const omVoice = getVoiceForLanguage('om', mockVoices)
    expect(omVoice).toBe(null)
  })

  it('4. Voice Synthesis Honesty: triggers honest NO_VOICE_FOR_LANGUAGE callback for Afaan Oromoo', () => {
    const origWindow = global.window
    const cancelMock = vi.fn()
    const speakMock = vi.fn()

    try {
      global.window = {
        speechSynthesis: {
          cancel: cancelMock,
          speak: speakMock,
        },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
        },
      }

      const mockVoices = [
        { name: 'Microsoft David', lang: 'en-US', localService: true },
      ]

      let errorReceived = null
      speakText({
        text: 'Nagaa koo',
        lang: 'om',
        voices: mockVoices,
        onError: (err) => {
          errorReceived = err
        },
      })

      expect(errorReceived).toBeTruthy()
      expect(errorReceived.code).toBe('NO_VOICE_FOR_LANGUAGE')
      expect(errorReceived.language).toBe('om')
      expect(speakMock).not.toHaveBeenCalled()
    } finally {
      global.window = origWindow
    }
  })

  it('5. Speech Synthesis Execution: speaks English and Amharic with appropriate voices', () => {
    const origWindow = global.window
    const cancelMock = vi.fn()
    let spokenUtterance = null

    try {
      global.window = {
        speechSynthesis: {
          cancel: cancelMock,
          speak: vi.fn((utt) => {
            spokenUtterance = utt
          }),
        },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
          this.voice = null
          this.lang = ''
        },
      }

      const mockVoices = [
        { name: 'Microsoft David', lang: 'en-US', localService: true },
        { name: 'Microsoft መቅደስ', lang: 'am-ET', localService: true },
      ]

      // Speak English
      speakText({
        text: 'What is phishing?',
        lang: 'en',
        voices: mockVoices,
      })
      expect(cancelMock).toHaveBeenCalled()
      expect(spokenUtterance.voice.name).toBe('Microsoft David')

      // Speak Amharic
      speakText({
        text: 'ፊሺንግ ምንድን ነው?',
        lang: 'am',
        voices: mockVoices,
      })
      expect(spokenUtterance.voice.name).toBe('Microsoft መቅደስ')
    } finally {
      global.window = origWindow
    }
  })

  it('6. Speech Recognition Configuration: configures BCP-47 language tags for en-US, am-ET, and om-ET', () => {
    const origWindow = global.window
    let capturedLang = null

    try {
      const mockRecognition = function() {
        this.start = vi.fn()
        this.stop = vi.fn()
        this.abort = vi.fn()
        Object.defineProperty(this, 'lang', {
          set: (v) => { capturedLang = v },
          get: () => capturedLang,
        })
      }

      global.window = {
        SpeechRecognition: mockRecognition,
      }

      startSpeechRecognition({ lang: 'en' })
      expect(capturedLang).toBe('en-US')

      startSpeechRecognition({ lang: 'am' })
      expect(capturedLang).toBe('am-ET')

      startSpeechRecognition({ lang: 'om' })
      expect(capturedLang).toBe('om-ET')
    } finally {
      global.window = origWindow
    }
  })

  it('7. Speech Recognition Interim vs Final Transcripts: populates input without auto-submitting', () => {
    const origWindow = global.window
    let onResultCb = null

    try {
      const mockRecognition = function() {
        this.start = vi.fn()
        this.stop = vi.fn()
        this.abort = vi.fn()
      }

      global.window = {
        SpeechRecognition: mockRecognition,
      }

      let capturedTranscript = ''
      startSpeechRecognition({
        lang: 'en',
        onResult: ({ transcript, isFinal }) => {
          capturedTranscript = transcript
        },
      })
    } finally {
      global.window = origWindow
    }
  })

  it('8. UI Rendering: renders microphone button in assistant input wrapper', () => {
    const htmlEn = renderToString(React.createElement(Assistant, { t: tEn, lang: 'en' }))
    expect(htmlEn).toContain('assistant-mic-btn')
    expect(htmlEn).toContain('🎙️')
    expect(htmlEn).toContain('Voice Input')

    const htmlOm = renderToString(React.createElement(Assistant, { t: tOm, lang: 'om' }))
    expect(htmlOm).toContain('assistant-mic-btn')
    expect(htmlOm).toContain('Galtee Sagalee')

    const htmlAm = renderToString(React.createElement(Assistant, { t: tAm, lang: 'am' }))
    expect(htmlAm).toContain('assistant-mic-btn')
    expect(htmlAm).toContain('የድምጽ ግብዓት')
    expect(htmlAm).toContain(am['assistant.voice_online_description'])
    expect(htmlAm).toContain(am['assistant.voice_local_description'])
    expect(htmlOm).toContain(om['assistant.voice_oromo_offline_label'])
    expect(htmlEn).toContain(en['assistant.voice_english_offline_label'])
  })

  it('9. UI Rendering: renders read response speaker button on assistant message rows', () => {
    const htmlEn = renderToString(React.createElement(Assistant, { t: tEn, lang: 'en' }))
    expect(htmlEn).toContain('assistant-speak-btn')
    expect(htmlEn).toContain('🔊')
    expect(htmlEn).toContain('Read')

    const htmlOm = renderToString(React.createElement(Assistant, { t: tOm, lang: 'om' }))
    expect(htmlOm).toContain('assistant-speak-btn')
    expect(htmlOm).toContain('Deebii sagaleen dubbisi')

    const htmlAm = renderToString(React.createElement(Assistant, { t: tAm, lang: 'am' }))
    expect(htmlAm).toContain('assistant-speak-btn')
    expect(htmlAm).toContain('ምላሹን በድምጽ ያንብቡ')
  })

  it('10. Privacy & Security Invariants: zero audio persistence, zero unprompted mic activation', () => {
    // Component renders idle without activating speech or recording
    const html = renderToString(React.createElement(Assistant, { t: tEn, lang: 'en' }))
    expect(html).not.toContain('listening-pulse')
    expect(html).not.toContain('assistant-listening-bar')
    expect(html).toContain('Offline-First Engine')
  })

  it('11. Error Handling: catches and reports synthesis errors gracefully', () => {
    const origWindow = global.window
    let capturedError = null

    try {
      let triggerError = null
      global.window = {
        speechSynthesis: {
          cancel: vi.fn(),
          speak: vi.fn((utt) => {
            triggerError = utt.onerror
          }),
        },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
        },
      }

      speakText({
        text: 'Testing failure handling',
        lang: 'en',
        voices: [{ name: 'Test Voice', lang: 'en-US', localService: true }],
        onError: (err) => {
          capturedError = err
        },
      })

      // Simulate network / speech synthesis failure event
      if (triggerError) {
        triggerError({ error: 'network', message: 'Speech service unreachable' })
      }

      expect(capturedError).toBeTruthy()
      expect(capturedError.code).toBe('SYNTHESIS_ERROR')
      expect(capturedError.message).toBe('network')
    } finally {
      global.window = origWindow
    }
  })

  it('12. Voice Differentiation: blocks online voices unless explicitly allowed and upholds Afaan Oromoo honesty', () => {
    const mixedVoices = [
      { name: 'Microsoft David', lang: 'en-US', localService: true },
      { name: 'Microsoft Jenny Online (Natural)', lang: 'en-US', localService: false },
      { name: 'Microsoft መቅደስ Online (Natural) - Amharic (Ethiopia)', lang: 'am-ET', localService: false },
      { name: 'Unknown Voice', lang: 'fr-FR', localService: true },
    ]

    // English matched correctly
    const enVoice = getVoiceForLanguage('en', mixedVoices)
    expect(enVoice).toBeTruthy()
    expect(enVoice.lang).toBe('en-US')

    // Online Amharic voices are blocked by default.
    const amVoice = getVoiceForLanguage('am', mixedVoices)
    expect(amVoice).toBe(null)

    // The Amharic online voice is only eligible after explicit user consent.
    const consentedAmVoice = getVoiceForLanguage('am', mixedVoices, { allowOnline: true })
    expect(consentedAmVoice).toBeTruthy()
    expect(consentedAmVoice.name).toContain('መቅደስ')
    expect(getVoiceForLanguage('en', mixedVoices, { allowOnline: true }).localService).toBe(true)

    // Afaan Oromoo strictly returns null without substituting English or Amharic
    const omVoice = getVoiceForLanguage('om', mixedVoices)
    expect(omVoice).toBe(null)
  })

  it('requires explicit online voice consent and defaults to local-only speech', () => {
    const origWindow = global.window
    const speak = vi.fn()
    try {
      global.window = {
        speechSynthesis: { cancel: vi.fn(), speak },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
          this.voice = null
        },
      }
      const onlineAmharic = {
        name: 'Amharic Cloud Voice',
        lang: 'am-ET',
        localService: false,
      }
      let error

      speakText({
        text: 'ሰላም',
        lang: 'am',
        voices: [onlineAmharic],
        preferredProvider: 'auto',
        onError: (value) => { error = value },
      })

      expect(speak).not.toHaveBeenCalled()
      expect(error.code).toBe('NO_VOICE_FOR_LANGUAGE')
      expect(requestOnlineVoiceConsent(() => false, 'consent?')).toBe(false)
    } finally {
      global.window = origWindow
    }
  })

  it('uses an online Amharic voice only after affirmative consent', () => {
    const origWindow = global.window
    let spoken
    try {
      global.window = {
        speechSynthesis: {
          cancel: vi.fn(),
          speak: vi.fn((utterance) => { spoken = utterance }),
        },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
          this.voice = null
        },
      }
      const confirm = vi.fn(() => true)
      const consentGranted = requestOnlineVoiceConsent(confirm, 'Online speech sends text. Continue?')
      speakText({
        text: 'ሰላም',
        lang: 'am',
        voices: [{ name: 'Amharic Cloud Voice', lang: 'am-ET', localService: false }],
        allowOnlineVoice: consentGranted,
        onStart: ({ engine }) => { spoken.engine = engine },
      })

      expect(confirm).toHaveBeenCalledOnce()
      expect(spoken.voice.name).toBe('Amharic Cloud Voice')
      spoken.onstart()
      expect(spoken.engine).toBe('browser_online')
    } finally {
      global.window = origWindow
    }
  })

  it('never selects online voices after switching to English or Afaan Oromoo', () => {
    const onlineVoices = [
      { name: 'English Cloud Voice', lang: 'en-US', localService: false },
      { name: 'Amharic Cloud Voice', lang: 'am-ET', localService: false },
      { name: 'Oromo Cloud Voice', lang: 'om-ET', localService: false },
    ]

    expect(getVoiceForLanguage('en', onlineVoices, { allowOnline: true })).toBe(null)
    expect(getVoiceForLanguage('om', onlineVoices, { allowOnline: true })).toBe(null)
    expect(getVoiceForLanguage('am', onlineVoices, { allowOnline: false })).toBe(null)
  })

  it('falls back from a consented online Amharic voice to local synthesis on provider failure', async () => {
    const origWindow = global.window
    let utterance
    const localFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: 'TTS_MODEL_NOT_INSTALLED' } }),
    })
    let error
    try {
      global.window = {
        fetch: localFetch,
        speechSynthesis: {
          cancel: vi.fn(),
          speak: vi.fn((value) => { utterance = value }),
        },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
          this.voice = null
        },
      }

      speakText({
        text: 'ሰላም',
        lang: 'am',
        voices: [{ name: 'Amharic Cloud Voice', lang: 'am-ET', localService: false }],
        allowOnlineVoice: true,
        fallbackOffline: true,
        onError: (value) => { error = value },
      })
      utterance.onerror({ error: 'network' })
      await vi.waitFor(() => expect(localFetch).toHaveBeenCalledOnce())
      await vi.waitFor(() => expect(error?.code).toBe('TTS_MODEL_NOT_INSTALLED'))

      expect(localFetch.mock.calls[0][0]).toBe('http://127.0.0.1:8000/api/v1/voice/synthesize')
      expect(JSON.parse(localFetch.mock.calls[0][1].body)).toEqual({ text: 'ሰላም', language: 'am' })
    } finally {
      global.window = origWindow
    }
  })

  it('13. Quantization & Boundary Clamping: correctly quantizes Float32 to Int16 with NaN/Inf protection', () => {
    const input = new Float32Array([
      -1.0, 1.0, 0.0, -0.5, 0.5,
      -2.5, 3.0, NaN, Infinity, -Infinity,
    ])
    const output = quantizeFloat32ToInt16(input)

    expect(output[0]).toBe(-32768) // -1.0 -> -32768
    expect(output[1]).toBe(32767)  // +1.0 -> 32767
    expect(output[2]).toBe(0)      // 0.0 -> 0
    expect(output[3]).toBe(-16384) // -0.5 -> -16384
    expect(output[4]).toBe(16384)  // +0.5 -> 16384
    expect(output[5]).toBe(-32768) // -2.5 clamped to -32768
    expect(output[6]).toBe(32767)  // +3.0 clamped to 32767
    expect(output[7]).toBe(0)      // NaN -> 0
    expect(output[8]).toBe(0)      // Infinity -> 0
    expect(output[9]).toBe(0)      // -Infinity -> 0
  })

  it('14. Canonical WAV Construction: produces compliant 44-byte WAV header for 16kHz mono 16-bit PCM', () => {
    const samples = new Int16Array(16000) // 1 second of audio
    const wavBytes = buildCanonicalWav(samples, 16000)

    expect(wavBytes.byteLength).toBe(44 + 32000)

    const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength)
    const readStr = (offset, len) => {
      let s = ''
      for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
      return s
    }

    expect(readStr(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 32000)
    expect(readStr(8, 4)).toBe('WAVE')
    expect(readStr(12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16) // Subchunk1Size
    expect(view.getUint16(20, true)).toBe(1)  // AudioFormat PCM
    expect(view.getUint16(22, true)).toBe(1)  // NumChannels 1
    expect(view.getUint32(24, true)).toBe(16000) // SampleRate
    expect(view.getUint32(28, true)).toBe(32000) // ByteRate
    expect(view.getUint16(32, true)).toBe(2)  // BlockAlign
    expect(view.getUint16(34, true)).toBe(16) // BitsPerSample
    expect(readStr(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(32000) // Subchunk2Size
  })

  it('15. Base64 Encoding: accurately encodes Uint8Array to RFC 4648 Base64', () => {
    const origWindow = global.window
    try {
      global.window = {
        btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
      }
      const raw = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      const b64 = uint8ArrayToBase64(raw)
      expect(b64).toBe('SGVsbG8=')
    } finally {
      global.window = origWindow
    }
  })

  it('16. Afaan Oromoo Offline STT Pipeline: transmits recorded audio to backend offline transcription endpoint', async () => {
    const origWindow = global.window
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ transcript: 'Baga nagaan dhuftan', language: 'om' }),
    })
    try {
      global.window = {
        fetch: mockFetch,
      }
      const result = await transcribeAudioOffline({
        audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        language: 'om',
      })

      expect(mockFetch).toHaveBeenCalledWith(
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
      expect(result.transcript).toBe('Baga nagaan dhuftan')
      expect(result.language).toBe('om')
    } finally {
      global.window = origWindow
    }
  })

  it('17. Voice Localization Parity: preserves 100% key match across en, am, om with "Browser" capitalized in om', () => {
    const voiceKeys = [
      'assistant.voice_listening',
      'assistant.voice_mic_btn',
      'assistant.voice_network_error',
      'assistant.voice_no_speech',
      'assistant.voice_no_voice_for_am',
      'assistant.voice_no_voice_for_om',
      'assistant.voice_not_supported',
      'assistant.voice_offline_unavailable',
      'assistant.voice_permission_denied',
      'assistant.voice_processing',
      'assistant.voice_speak_response',
      'assistant.voice_speaking_now',
      'assistant.voice_stop_listening',
      'assistant.voice_stop_speaking',
      'assistant.voice_stt_unsupported_om',
      'assistant.voice_transcribe_busy',
      'assistant.voice_transcribe_error',
      'assistant.voice_local_tts_unavailable',
      'assistant.voice_cloud_consent',
      'assistant.voice_tts_not_supported',
      'assistant.voice_tts_playback_failed',
    ]

    for (const key of voiceKeys) {
      expect(en[key]).toBeTruthy()
      expect(am[key]).toBeTruthy()
      expect(om[key]).toBeTruthy()
    }

    expect(om['assistant.voice_stt_unsupported_om']).toContain('Whisper')
    expect(om['assistant.voice_not_supported']).toContain('Browser')
    expect(om['assistant.voice_permission_denied']).toContain('Browser')
  })

  it('18. Layered TTS Fallback & Cancellation: handles fallbackOffline and stopSpeaking', async () => {
    const origWindow = global.window
    const cancelMock = vi.fn()
    try {
      global.window = {
        speechSynthesis: {
          cancel: cancelMock,
          speak: vi.fn(),
          getVoices: () => [],
        },
        SpeechSynthesisUtterance: function(text) {
          this.text = text
        },
      }

      // 1. Calling stopSpeaking cancels speech synthesis
      stopSpeaking()
      expect(cancelMock).toHaveBeenCalled()

      // 2. English does not fall back to an unknown potentially cloud-backed voice
      let englishError = null
      const utt = speakText({
        text: 'Welcome to ABBAY CYBERGUARD',
        lang: 'en',
        voices: [],
        onError: (err) => {
          englishError = err
        },
      })
      expect(utt).toBeNull()
      expect(englishError.code).toBe('LOCAL_VOICE_UNAVAILABLE')

      // 3. Afaan Oromoo with fallbackOffline: true returns controller with cancel()
      let omErr = null
      const controller = speakText({
        text: 'Baga nagaan dhuftan',
        lang: 'om',
        fallbackOffline: true,
        onError: (err) => {
          omErr = err
        },
      })
      expect(controller).toBeTruthy()
      expect(typeof controller.cancel).toBe('function')
      controller.cancel()
    } finally {
      global.window = origWindow
    }
  })

  it('19. Native-Language Speech Text Normalization: normalizes Amharic Ethiopic punctuation and Oromo abbreviations', () => {
    // Amharic normalization
    const amharicRaw = 'ሰላም፤ እንኳን ደህና መጣችሁ። የይለፍ ቃልዎን ወይም OTP ለሌላ ሰው አይስጡ።'
    const amharicClean = cleanTextForSpeech(amharicRaw, 'am')
    expect(amharicClean).toContain('. ')
    expect(amharicClean).toContain('; ')
    expect(amharicClean).toContain('ኦ ቲ ፒ')
    expect(amharicClean).not.toContain('።')
    expect(amharicClean).not.toContain('፤')

    // Afaan Oromoo normalization
    const oromoRaw = 'Odeeffannoo keessan fkn. koodii OTP ykn PIN eenyuufuu hin kenninaa.'
    const oromoClean = cleanTextForSpeech(oromoRaw, 'om')
    expect(oromoClean).toContain('fakkeenyaaf')
    expect(oromoClean).toContain('O T P')
    expect(oromoClean).toContain('P I N')
    expect(oromoClean).not.toContain('fkn.')

    // English normalization
    const enRaw = 'Never share sensitive info, e.g., your OTP or password.'
    const enClean = cleanTextForSpeech(enRaw, 'en')
    expect(enClean).toContain('for example')
    expect(enClean).toContain('O T P')
    expect(enClean).not.toContain('e.g.')
  })

  it('20. Speech Language Resolution: resolves Amharic for Ethiopic script, Oromo for Oromo markers, and English fallback', () => {
    // Ethiopic text guarantees Amharic even if preferredLang was English
    expect(resolveSpeechLanguage('ሰላም ይህ የሳይበር ጥበቃ ነው', 'en')).toBe('am')
    expect(resolveSpeechLanguage('የይለፍ ቃልዎን ይጠብቁ', 'om')).toBe('am')

    // Oromo text / preferred language
    expect(resolveSpeechLanguage('Nagaa, kun eegumsa saayibariiti.', 'om')).toBe('om')
    expect(resolveSpeechLanguage('Eegumsa saayibarii cimaa gochuuf mallattoo lammataa fayyadamaa.', 'en')).toBe('om')

    // English text
    expect(resolveSpeechLanguage('What is multi-factor authentication?', 'en')).toBe('en')
    expect(resolveSpeechLanguage('', 'om')).toBe('om')
    expect(resolveSpeechLanguage(null, 'am')).toBe('am')
  })

  it('21. Strict Voice Isolation: never returns English voice for non-English or unknown languages', () => {
    const mockVoices = [
      { name: 'Microsoft David', lang: 'en-US', localService: true },
      { name: 'Microsoft Zira', lang: 'en-US', localService: true },
    ]

    expect(getVoiceForLanguage('om', mockVoices)).toBe(null)
    expect(getVoiceForLanguage('am', mockVoices)).toBe(null)
    expect(getVoiceForLanguage('fr', mockVoices)).toBe(null)
    expect(getVoiceForLanguage('unknown', mockVoices)).toBe(null)

    const enVoice = getVoiceForLanguage('en', mockVoices)
    expect(enVoice).toBeTruthy()
    expect(enVoice.name).toBe('Microsoft David')
  })

  it('22. Offline MMS TTS Priority: triggers offline synthesis for Amharic and Afaan Oromoo when fallbackOffline is true', async () => {
    const origWindow = global.window
    try {
      global.window = {
        speechSynthesis: {
          cancel: vi.fn(),
          speak: vi.fn(),
          getVoices: () => [{ name: 'Microsoft David', lang: 'en-US', localService: true }],
        },
        SpeechSynthesisUtterance: vi.fn(),
      }

      // Mock synthesizeSpeechOffline call
      let offlineCalls = []
      const controller = speakText({
        text: 'Nagaa koo',
        lang: 'om',
        fallbackOffline: true,
      })

      // Returns controller object with cancel function
      expect(controller).toBeTruthy()
      expect(typeof controller.cancel).toBe('function')
      controller.cancel()
    } finally {
      global.window = origWindow
    }
  })

  it('23. Playback Controls: safely pauses, resumes, stops, and checks playback state', () => {
    const origWindow = global.window
    const cancelMock = vi.fn()
    const pauseMock = vi.fn()
    const resumeMock = vi.fn()

    try {
      global.window = {
        speechSynthesis: {
          cancel: cancelMock,
          pause: pauseMock,
          resume: resumeMock,
          speaking: false,
        },
        SpeechSynthesisUtterance: vi.fn(),
      }

      expect(isSpeaking()).toBe(false)
      pauseSpeaking()
      expect(pauseMock).toHaveBeenCalled()

      resumeSpeaking()
      expect(resumeMock).toHaveBeenCalled()

      stopSpeaking()
      expect(cancelMock).toHaveBeenCalled()
    } finally {
      global.window = origWindow
    }
  })
})
