import React, { useState, useEffect, useRef } from 'react'
import { chatWithAssistant, getAssistantStatus } from '../lib/api.js'
import { BotIcon, SparklesIcon } from './Icons.jsx'
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  getAvailableVoices,
  resolveSpeechLanguage,
  speakText,
  stopSpeaking,
  recordAudioClip,
  resampleAudioBufferTo16kHz,
  quantizeFloat32ToInt16,
  buildCanonicalWav,
  uint8ArrayToBase64,
  transcribeAudioOffline,
} from '../lib/voiceAssistant.js'

export function normalizeMarkdownEscapes(text) {
  if (!text) return ''
  return String(text).replace(/\\([*_`#[\]()\\.-])/g, '$1')
}

export function parseInlineMarkdown(text) {
  if (!text) return []
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  const parts = String(text).split(tokenRegex)

  return parts.map((part, index) => {
    if (!part) return null

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="assistant-strong">
          {part.slice(2, -2)}
        </strong>
      )
    }

    // Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="assistant-inline-code">
          {part.slice(1, -1)}
        </code>
      )
    }

    // Link [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const [, label, url] = linkMatch
      const isInternal = url.startsWith('#') || url.startsWith('/')
      return (
        <a
          key={index}
          href={url}
          className="assistant-inline-link"
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
        >
          {label}
        </a>
      )
    }

    // Plain text (React escapes untrusted content automatically)
    return part
  }).filter(Boolean)
}

export function FormattedMessage({ content }) {
  if (!content) return null
  const normalized = normalizeMarkdownEscapes(content)
  const rawLines = normalized.split('\n')

  const blocks = []
  let currentList = null // { type: 'ol' | 'ul', items: [] }
  let currentParagraph = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'p', lines: [...currentParagraph] })
      currentParagraph = []
    }
  }

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList)
      currentList = null
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    // Heading: #{1,4}
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({
        type: headingMatch[1].length <= 2 ? 'h3' : 'h4',
        text: headingMatch[2],
      })
      continue
    }

    // Ordered list item: \d+\.\s+
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      flushParagraph()
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(olMatch[2])
      continue
    }

    // Bullet list item: [•\-\*]\s+
    const ulMatch = trimmed.match(/^[•\-\*]\s+(.+)$/)
    if (ulMatch) {
      flushParagraph()
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(ulMatch[1])
      continue
    }

    // Normal text line in paragraph
    flushList()
    currentParagraph.push(line)
  }

  flushParagraph()
  flushList()

  return (
    <div className="msg-body-content">
      {blocks.map((block, bIdx) => {
        if (block.type === 'h3') {
          return (
            <h3 key={bIdx} className="assistant-heading-h3">
              {parseInlineMarkdown(block.text)}
            </h3>
          )
        }
        if (block.type === 'h4') {
          return (
            <h4 key={bIdx} className="assistant-heading-h4">
              {parseInlineMarkdown(block.text)}
            </h4>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={bIdx} className="assistant-ordered-list">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="assistant-list-item">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={bIdx} className="assistant-bullet-list">
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="assistant-list-item">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bIdx} className="msg-paragraph">
            {block.lines.map((l, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {parseInlineMarkdown(l)}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export function resolveModuleShortcut(matchedTopic, t) {
  if (!matchedTopic) return null

  if (matchedTopic.startsWith('m5') || matchedTopic === 'm5_learn_quizzes') {
    return {
      route: 'learn',
      label: t('nav.learn') || 'M5 Cyber Academy',
    }
  }
  if (matchedTopic.startsWith('journey') || matchedTopic === 'journey_hero_missions') {
    return {
      route: 'journey',
      label: t('nav.journey') || 'Cyber Hero Journey',
    }
  }
  if (matchedTopic === 'reporting_contacts_ethiopia' || matchedTopic === 'what_to_do_clicked_link' || matchedTopic.startsWith('m3')) {
    return {
      route: 'm3',
      label: t('nav.m3') || 'Module M3 Incident Report',
    }
  }
  if (matchedTopic.startsWith('m1')) {
    return {
      route: 'm1',
      label: t('nav.m1') || 'Module M1 Link Checker',
    }
  }
  if (matchedTopic.startsWith('m2')) {
    return {
      route: 'm2',
      label: t('nav.m2') || 'Module M2 Password Vault',
    }
  }
  if (matchedTopic.startsWith('m4')) {
    return {
      route: 'm4',
      label: t('nav.m4') || 'Module M4 Security Simulation',
    }
  }
  return null
}

export function getContextConfig(context, t) {
  if (!context) return null

  const normalized = context === 'm5' ? 'learn' : context

  if (normalized === 'm1') {
    return {
      moduleKey: 'm1',
      moduleName: t('nav.m1') || 'M1 Link Checker',
      route: '#/m1',
      welcomeMsg: t('assistant.ctx_m1_welcome') || 'Hello! I am ready to help you with Module M1 Suspicious Link & SMS Checker. You can ask how local heuristic checks work, what to do if you already tapped a suspicious link, or M1\'s safety boundaries.',
      suggestedFollowups: [
        t('assistant.ctx_m1_q1') || 'How does M1 Link Checker work?',
        t('assistant.ctx_m1_q2') || 'What if I already clicked a suspicious link?',
        t('assistant.ctx_m1_q3') || 'What are M1 limitations?',
      ],
      matchedTopic: 'm1_link_checker',
    }
  }

  if (normalized === 'm2') {
    return {
      moduleKey: 'm2',
      moduleName: t('nav.m2') || 'M2 Password Vault',
      route: '#/m2',
      welcomeMsg: t('assistant.ctx_m2_welcome') || 'Hello! I am ready to help you with Module M2 Password Vault & Generator. Ask me about passphrase entropy, offline generation security, two-factor authentication (2FA), or password managers.',
      suggestedFollowups: [
        t('assistant.ctx_m2_q1') || 'Give me an example of a passphrase',
        t('assistant.ctx_m2_q2') || 'What is 2FA?',
        t('assistant.ctx_m2_q3') || 'What are M2 limitations?',
      ],
      matchedTopic: 'm2_password_vault',
    }
  }

  if (normalized === 'm3') {
    return {
      moduleKey: 'm3',
      moduleName: t('nav.m3') || 'M3 Incident Report',
      route: '#/m3',
      welcomeMsg: t('assistant.ctx_m3_welcome') || 'Hello! I am ready to help you with Module M3 Incident Report drafting. Ask me about preserving digital evidence, verified Ethiopian emergency contacts, or how to document fraud for authorities.',
      suggestedFollowups: [
        t('assistant.ctx_m3_q1') || 'How does M3 Incident Report work?',
        t('assistant.ctx_m3_q2') || 'Emergency Contacts',
        t('assistant.ctx_m3_q3') || 'What if I lost money?',
      ],
      matchedTopic: 'm3_incident_report',
    }
  }

  if (normalized === 'm4') {
    return {
      moduleKey: 'm4',
      moduleName: t('nav.m4') || 'M4 Security Simulation',
      route: '#/m4',
      welcomeMsg: t('assistant.ctx_m4_welcome') || 'Hello! I am ready to help you with Module M4 Website Security Simulation. Ask me about Content-Security-Policy (CSP), HSTS headers, TLS encryption, or how simulated fixtures protect your safety.',
      suggestedFollowups: [
        t('assistant.ctx_m4_q1') || 'Explain CSP in more detail',
        t('assistant.ctx_m4_q2') || 'What is HSTS?',
        t('assistant.ctx_m4_q3') || 'What are M4 limitations?',
      ],
      matchedTopic: 'm4_website_simulation',
    }
  }

  if (normalized === 'learn') {
    return {
      moduleKey: 'learn',
      moduleName: t('nav.learn') || 'M5 Cyber Academy',
      route: '#/learn',
      welcomeMsg: t('assistant.ctx_learn_welcome') || 'Hello! I am ready to help you with Module M5 Cyber Academy. Ask me to explain any cybersecurity topic, quiz concept, Ethiopian threat scenario, or how to earn progression XP.',
      suggestedFollowups: [
        t('assistant.ctx_learn_q1') || 'What is phishing?',
        t('assistant.ctx_learn_q2') || 'How do I secure Telebirr / CBE Birr?',
        t('assistant.ctx_learn_q3') || 'How do I earn XP?',
      ],
      matchedTopic: 'm5_learn_quizzes',
    }
  }

  if (normalized === 'journey') {
    return {
      moduleKey: 'journey',
      moduleName: t('nav.journey') || 'Cyber Hero Journey',
      route: '#/journey',
      welcomeMsg: t('assistant.ctx_journey_welcome') || 'Hello Defender! I am ready to guide your Cyber Hero Journey. Ask me about analyzing tactical mission evidence, real-world Ethiopian threat patterns, or strategic defense decisions.',
      suggestedFollowups: [
        t('assistant.ctx_journey_q1') || 'Tell me about Cyber Hero Journey',
        t('assistant.ctx_journey_q2') || 'How do I earn XP?',
        t('assistant.ctx_journey_q3') || 'What if I already clicked a suspicious link?',
      ],
      matchedTopic: 'journey_hero_missions',
    }
  }

  return null
}

export default function Assistant({ t, lang, onNavigate, assistantContext, initialQuery }) {
  const ctxConfig = React.useMemo(() => getContextConfig(assistantContext, t), [assistantContext, t])

  const buildInitialMessage = React.useCallback(() => {
    if (ctxConfig) {
      return {
        id: `ctx_welcome_${ctxConfig.moduleKey}`,
        role: 'assistant',
        content: ctxConfig.welcomeMsg,
        engine: 'offline_knowledge_v1',
        status: 'ANSWERED_OFFLINE',
        matchedTopic: ctxConfig.matchedTopic,
        suggestedFollowups: ctxConfig.suggestedFollowups,
        offlineCapable: true,
      }
    }
    return {
      id: 'initial_welcome',
      role: 'assistant',
      content: t('assistant.welcome_msg') || 'Hello! I am your CyberShield AI Assistant. Ask me questions about suspicious links, passwords, reporting scams, or digital security in Ethiopia.',
      engine: 'offline_knowledge_v1',
      status: 'ANSWERED_OFFLINE',
      suggestedFollowups: [
        t('assistant.quick_q1') || 'What is phishing?',
        t('assistant.quick_q2') || 'How do I secure Telebirr / CBE Birr?',
        t('assistant.quick_q3') || 'What if I already clicked a suspicious link?',
        t('assistant.quick_q4') || 'How does M1 Link Checker work?',
      ],
      offlineCapable: true,
    }
  }, [ctxConfig, t])

  const [messages, setMessages] = useState(() => [buildInitialMessage()])

  // Sync initial message if context changes
  useEffect(() => {
    setMessages([buildInitialMessage()])
  }, [buildInitialMessage])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusInfo, setStatusInfo] = useState(null)
  const [consentPendingMessage, setConsentPendingMessage] = useState(null)
  const [onlineConsentGiven, setOnlineConsentGiven] = useState(false)
  const messagesEndRef = useRef(null)

  // Voice Assistant State
  const [isListening, setIsListening] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [speakingMsgId, setSpeakingMsgId] = useState(null)
  const [speakingEngine, setSpeakingEngine] = useState(null)
  const [voiceError, setVoiceError] = useState(null)
  const [voices, setVoices] = useState([])
  const [voiceProvider, setVoiceProvider] = useState('auto')
  const recognitionRef = useRef(null)
  const recordingRef = useRef(null)

  useEffect(() => {
    let mounted = true
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const v = window.speechSynthesis.getVoices() || []
        if (v.length > 0 && mounted) {
          setVoices(v)
        }
      }
    }

    getAvailableVoices().then((v) => {
      if (mounted && v && v.length > 0) setVoices(v)
    }).catch(() => {})

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener?.('voiceschanged', updateVoices)
    }

    return () => {
      mounted = false
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.removeEventListener?.('voiceschanged', updateVoices)
      }
      stopSpeaking()
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }
      if (recordingRef.current) {
        try { recordingRef.current.cancel() } catch {}
      }
    }
  }, [])

  const processRecordedAudio = async (blob) => {
    setIsProcessingVoice(true)
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) {
        throw new Error('AudioContext not supported')
      }
      const audioCtx = new AudioCtx()
      let decoded
      try {
        decoded = await audioCtx.decodeAudioData(arrayBuffer)
      } finally {
        try { audioCtx.close() } catch {}
      }

      const resampledData = await resampleAudioBufferTo16kHz(decoded)
      const pcm16 = quantizeFloat32ToInt16(resampledData)
      const wavBytes = buildCanonicalWav(pcm16, 16000)
      const audioBase64 = uint8ArrayToBase64(wavBytes)

      const result = await transcribeAudioOffline({ audioBase64, language: lang })
      if (result.error) {
        if (result.error.code === 'TOO_MANY_REQUESTS') {
          setVoiceError(t('assistant.voice_transcribe_busy') || 'Speech engine is busy. Please try again in a moment.')
        } else if (result.error.code === 'STT_UNSUPPORTED_OFFLINE') {
          setVoiceError(t('assistant.voice_stt_unsupported_om') || 'Afaan Oromoo offline speech recognition is currently unsupported.')
        } else {
          setVoiceError(t('assistant.voice_transcribe_error') || 'Failed to transcribe speech.')
        }
      } else if (result.transcript) {
        setInput((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript))
      }
    } catch {
      setVoiceError(t('assistant.voice_transcribe_error') || 'Failed to process voice input.')
    } finally {
      setIsProcessingVoice(false)
    }
  }

  const handleToggleListen = async () => {
    setVoiceError(null)

    if (isListening) {
      if (recordingRef.current) {
        try {
          const blobPromise = recordingRef.current.stop()
          recordingRef.current = null
          setIsListening(false)
          const blob = await blobPromise
          if (blob && blob.size > 0) {
            await processRecordedAudio(blob)
          }
        } catch {
          setIsListening(false)
        }
        return
      }

      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
      setIsListening(false)
      return
    }

    // Offline-first STT: strictly use local audio capture and offline backend transcription pipeline
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError(t('assistant.voice_not_supported') || 'Speech recognition is not supported in this browser. You can type your query below.')
      return
    }

    try {
      let activeController = null
      activeController = await recordAudioClip({
        maxDurationMs: 15000,
        onAutoStop: async () => {
          setIsListening(false)
          if (recordingRef.current === activeController) {
            recordingRef.current = null
            try {
              const blob = await activeController.stop()
              if (blob && blob.size > 0) {
                await processRecordedAudio(blob)
              }
            } catch {}
          }
        },
      })
      recordingRef.current = activeController
      setIsListening(true)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError(t('assistant.voice_permission_denied') || 'Microphone permission was denied. Please allow microphone access in your browser settings to use voice input.')
      } else {
        setVoiceError(err.message || t('assistant.voice_not_supported') || 'Failed to start microphone recording.')
      }
    }
  }

  const handleToggleSpeak = (msgId, content, msgLanguage = null) => {
    setVoiceError(null)
    if (speakingMsgId === msgId) {
      stopSpeaking()
      setSpeakingMsgId(null)
      setSpeakingEngine(null)
      return
    }

    stopSpeaking()
    setSpeakingMsgId(msgId)
    setSpeakingEngine('preparing')

    const targetLang = resolveSpeechLanguage(content, msgLanguage || lang)

    speakText({
      text: content,
      lang: targetLang,
      voices,
      fallbackOffline: true,
      preferredProvider: voiceProvider,
      onStart: (info) => {
        setSpeakingMsgId(msgId)
        setSpeakingEngine(info?.engine || 'tts')
      },
      onEnd: () => {
        setSpeakingMsgId((curr) => (curr === msgId ? null : curr))
        setSpeakingEngine(null)
      },
      onError: (err) => {
        setSpeakingMsgId((curr) => (curr === msgId ? null : curr))
        setSpeakingEngine(null)
        const errLang = err?.language || targetLang
        if (err?.code === 'NO_VOICE_FOR_LANGUAGE') {
          if (errLang === 'om') {
            setVoiceError(t('assistant.voice_no_voice_for_om') || 'Afaan Oromoo voice synthesis is not supported on this device. Text guidance remains fully available.')
          } else if (errLang === 'am') {
            setVoiceError(t('assistant.voice_no_voice_for_am') || 'Amharic voice synthesis is not supported on this device. Text guidance remains fully available.')
          }
        } else if (err?.code === 'TTS_MODEL_NOT_INSTALLED') {
          setVoiceError(t('assistant.voice_model_not_installed') || `Offline voice model for ${errLang.toUpperCase()} is not installed. Text guidance remains available.`)
        } else if (err?.code === 'OFFLINE_UNAVAILABLE' || err?.code === 'BACKEND_UNREACHABLE') {
          setVoiceError(t('assistant.voice_service_unavailable') || 'Offline speech synthesis service is currently unreachable. Ensure local backend is running.')
        } else if (err?.code === 'NOT_SUPPORTED') {
          setVoiceError(t('assistant.voice_tts_not_supported') || 'Text-to-speech is not supported on this device.')
        } else if (err?.code === 'SYNTHESIS_ERROR' || err?.code === 'PLAYBACK_ERROR') {
          if (err.event?.error === 'network' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            setVoiceError(t('assistant.voice_network_error') || 'Voice service unavailable offline. Please check network or use text.')
          } else {
            setVoiceError(t('assistant.voice_tts_playback_failed') || 'Speech playback failed. Text guidance remains available.')
          }
        }
      },
    })
  }

  useEffect(() => {
    getAssistantStatus().then((s) => setStatusInfo(s)).catch(() => {})
  }, [])

  const hasTriggeredInitialQuery = useRef(false)
  useEffect(() => {
    if (initialQuery && !hasTriggeredInitialQuery.current) {
      hasTriggeredInitialQuery.current = true
      handleSend(initialQuery)
    }
  }, [initialQuery])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (textToSend = null, forceOnline = false) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    setError(null)
    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    // Build minimal context turns (last 4 turns)
    const context = nextMessages.slice(-5, -1).map((m) => ({
      role: m.role,
      content: m.content,
      matchedTopic: m.matchedTopic || null,
    }))

    try {
      const resp = await chatWithAssistant({
        message: text,
        language: lang,
        conversationContext: context,
        onlineConsent: onlineConsentGiven,
        forceOnline,
      })

      if (resp.status === 'ONLINE_CONSENT_REQUIRED') {
        // Hold this message for consent confirmation
        setConsentPendingMessage({ text, resp })
      }

      const assistantMsg = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: resp.reply,
        engine: resp.engine || 'offline_knowledge_v1',
        status: resp.status,
        language: resp.language || lang,
        matchedTopic: resp.matchedTopic,
        suggestedFollowups: resp.suggestedFollowups || [],
        warning: resp.warning,
        disclaimer: resp.disclaimer,
        onlineRecommended: resp.onlineRecommended,
        onlineAvailable: resp.onlineAvailable,
        offlineCapable: resp.offlineCapable,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(t('assistant.error_send') || 'Could not connect to the assistant. You can continue asking questions using offline knowledge.')
    } finally {
      setLoading(false)
    }
  }

  const handleConsentAccept = () => {
    setOnlineConsentGiven(true)
    const pending = consentPendingMessage
    setConsentPendingMessage(null)
    if (pending) {
      handleSend(pending.text, true)
    }
  }

  const handleConsentDecline = () => {
    setConsentPendingMessage(null)
    // Add safe note confirming user chose to remain offline
    const declineMsg = {
      id: `asst_declined_${Date.now()}`,
      role: 'assistant',
      content: t('assistant.decline_offline_note') || 'Understood. Staying completely offline. What else can I assist you with using verified local knowledge?',
      engine: 'offline_knowledge_v1',
      status: 'ANSWERED_OFFLINE',
      suggestedFollowups: [
        t('assistant.quick_q1') || 'What is phishing?',
        t('assistant.quick_q4') || 'How does M1 Link Checker work?',
      ],
      offlineCapable: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, declineMsg])
  }

  const handleClearChat = () => {
    stopSpeaking()
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
    setSpeakingMsgId(null)
    setSpeakingEngine(null)
    setVoiceError(null)
    setMessages([
      {
        ...buildInitialMessage(),
        id: `welcome_${Date.now()}`,
      },
    ])
    setConsentPendingMessage(null)
    setError(null)
  }

  return (
    <div className="assistant-container" id="assistant-view">
      {/* Top Header Card */}
      <div className="card assistant-header-card">
        <div className="assistant-header-titles">
          <div className="assistant-avatar-shield" aria-hidden="true">
            <BotIcon size={24} className="assistant-header-bot-icon" />
          </div>
          <div>
            <h2 className="assistant-main-title">{t('assistant.title') || 'CyberShield AI Assistant'}</h2>
            <p className="small assistant-subtitle">
              {t('assistant.subtitle') || 'Privacy-preserving, offline-first cybersecurity conversational guide'}
            </p>
          </div>
        </div>

        <div className="assistant-header-actions">
          <span className="assistant-mode-pill pill-offline">
            🛡️ {t('assistant.pill_offline_first') || 'Offline-First Engine'}
          </span>
          {lang === 'am' && (
            <div className="assistant-voice-provider-toggle" role="group" aria-label="Amharic Voice Provider" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                className={`btn btn-xs ${voiceProvider === 'auto' ? 'btn-primary' : 'ghost'}`}
                onClick={() => setVoiceProvider('auto')}
                title="Microsoft መቅደስ Online (Natural Female Voice, Edge/Cloud)"
              >
                🌐 መቅደስ Online
              </button>
              <button
                type="button"
                className={`btn btn-xs ${voiceProvider === 'offline_mms' ? 'btn-primary' : 'ghost'}`}
                onClick={() => setVoiceProvider('offline_mms')}
                title="MMS Amharic (100% Offline Engine, Single Speaker)"
              >
                🛡️ MMS Offline
              </button>
            </div>
          )}
          {lang === 'om' && (
            <span className="assistant-mode-pill pill-offline" title="facebook/mms-tts-orm (100% Offline CPU Engine, Single Speaker)">
              🛡️ MMS Oromo (Offline)
            </span>
          )}
          {lang === 'en' && (
            <span className="assistant-mode-pill pill-offline" title="Windows OneCore (100% Offline Local Voice)">
              🛡️ OneCore (Offline)
            </span>
          )}
          <button
            type="button"
            className="btn ghost btn-sm assistant-clear-btn"
            onClick={handleClearChat}
            title={t('assistant.clear_chat_title') || 'Start a new conversation'}
          >
            🗑️ {t('assistant.clear_btn') || 'New Chat'}
          </button>
        </div>
      </div>

      {/* Context-Aware Assistance Banner */}
      {ctxConfig && (
        <div className="card assistant-context-banner" role="status">
          <div className="assistant-context-info">
            <span className="assistant-context-icon" aria-hidden="true">📍</span>
            <div className="assistant-context-text-wrap">
              <span className="assistant-context-tag">
                {t('assistant.ctx_banner_label') || 'Context-Aware Assistance'}
              </span>
              <strong className="assistant-context-name">{ctxConfig.moduleName}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-cyan assistant-return-btn"
            onClick={() => {
              if (onNavigate) {
                onNavigate(ctxConfig.route)
              } else {
                window.location.hash = ctxConfig.route
              }
            }}
          >
            {t('assistant.back_to_module') ? t('assistant.back_to_module').replace('{module}', ctxConfig.moduleName) : `← Back to ${ctxConfig.moduleName}`}
          </button>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="card assistant-chat-box" role="log" aria-live="polite">
        <div className="assistant-messages-list">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`assistant-msg-row ${m.role === 'user' ? 'msg-row-user' : 'msg-row-assistant'}`}
            >
              <div className="msg-avatar" aria-hidden="true">
                {m.role === 'user' ? (
                  <span className="msg-avatar-icon">👤</span>
                ) : (
                  <SparklesIcon size={18} className="msg-avatar-sparkles" />
                )}
              </div>

              <div className="msg-bubble-wrap">
                <div className="msg-meta-row">
                  <span className="msg-author-label">
                    {m.role === 'user' ? (t('assistant.user_label') || 'You') : (t('assistant.bot_label') || 'CyberShield AI')}
                  </span>
                  {m.timestamp && <span className="msg-timestamp">{m.timestamp}</span>}

                  {m.role === 'assistant' && (
                    <span className={`engine-badge ${m.engine === 'online_ai' ? 'badge-online' : 'badge-offline'}`}>
                      {m.engine === 'online_ai'
                        ? `⚡ ${t('assistant.badge_online') || 'Online AI'}`
                        : `🛡️ ${t('assistant.badge_offline') || 'Offline Knowledge'}`}
                    </span>
                  )}

                  {m.role === 'assistant' && (
                    <button
                      type="button"
                      className={`btn ghost btn-sm assistant-speak-btn ${speakingMsgId === m.id ? 'speaking-active' : ''}`}
                      onClick={() => handleToggleSpeak(m.id, m.content, m.language)}
                      title={speakingMsgId === m.id ? (t('assistant.voice_stop_speaking') || 'Stop speaking') : (t('assistant.voice_speak_response') || 'Read response aloud')}
                      aria-label={speakingMsgId === m.id ? (t('assistant.voice_stop_speaking') || 'Stop speaking') : (t('assistant.voice_speak_response') || 'Read response aloud')}
                    >
                      <span aria-hidden="true">{speakingMsgId === m.id ? '⏹️' : '🔊'}</span>
                      <span className="speak-label-text">
                        {speakingMsgId === m.id ? (t('assistant.voice_stop_speaking') || 'Stop') : (t('assistant.voice_speak_response') || 'Read')}
                      </span>
                    </button>
                  )}

                  {m.role === 'assistant' && speakingMsgId === m.id && (
                    <span className="speaking-engine-badge" aria-live="polite">
                      {speakingEngine === 'preparing'
                        ? (lang === 'om' ? '⏳ Qophaa\'aa jira...' : lang === 'am' ? '⏳ በመዘጋጀት ላይ...' : '⏳ Preparing...')
                        : (speakingEngine === 'offline_mms' ? '🛡️ MMS VITS' : '🔊 Voice')}
                    </span>
                  )}
                </div>

                {/* Sensitive Warning Box */}
                {m.warning && (
                  <div className="assistant-warning-alert" role="alert">
                    <span aria-hidden="true">⚠️</span> {m.warning}
                  </div>
                )}

                {/* Bubble Body with Safe Markdown & Escape Formatting */}
                <FormattedMessage content={m.content} />

                {/* Follow-up Suggestions Chips */}
                {m.suggestedFollowups && m.suggestedFollowups.length > 0 && !loading && (
                  <div className="assistant-followups-container">
                    <span className="followup-label small">{t('assistant.suggested_prompts_label') || 'Suggested follow-ups:'}</span>
                    <div className="followup-chips-row">
                      {m.suggestedFollowups.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="btn-chip"
                          onClick={() => handleSend(chip)}
                        >
                          💬 {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Link to Module if matched */}
                {(() => {
                  const shortcut = resolveModuleShortcut(m.matchedTopic, t)
                  if (!shortcut) return null
                  return (
                    <div className="assistant-module-shortcut">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-cyan"
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate(shortcut.route)
                          } else {
                            window.location.hash = `#/${shortcut.route}`
                          }
                        }}
                      >
                        🚀 {shortcut.label} →
                      </button>
                    </div>
                  )
                })()}
              </div>
            </div>
          ))}

          {loading && (
            <div className="assistant-msg-row msg-row-assistant">
              <div className="msg-avatar" aria-hidden="true">🛡️</div>
              <div className="msg-bubble-wrap">
                <div className="assistant-typing-indicator" aria-label="Thinking...">
                  <span className="dot dot1"></span>
                  <span className="dot dot2"></span>
                  <span className="dot dot3"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Online Consent Dialog Prompt if required */}
        {consentPendingMessage && (
          <div className="card consent-modal-banner" role="dialog" aria-labelledby="consent-title">
            <div className="consent-banner-header">
              <span className="consent-icon" aria-hidden="true">🌐</span>
              <div>
                <h4 id="consent-title" className="consent-title">{t('assistant.consent_modal_title') || 'External Online AI Consultation'}</h4>
                <p className="small consent-desc">
                  {t('assistant.consent_modal_desc') || 'The offline database has limited real-time information for this query. Would you like to consult the external AI provider? No personal passwords or private tokens will ever be transmitted.'}
                </p>
              </div>
            </div>
            <div className="consent-actions-row">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConsentAccept}
              >
                ✅ {t('assistant.consent_allow_btn') || 'Consult Online AI'}
              </button>
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={handleConsentDecline}
              >
                🛡️ {t('assistant.consent_stay_offline_btn') || 'Stay Offline'}
              </button>
            </div>
          </div>
        )}

        {/* Voice Error Alert */}
        {voiceError && (
          <div className="assistant-voice-alert small" role="alert">
            <span>ℹ️ {voiceError}</span>
            <button type="button" className="btn-text-close" onClick={() => setVoiceError(null)}>✕</button>
          </div>
        )}

        {/* Listening Active Bar */}
        {isListening && (
          <div className="assistant-listening-bar" role="status" aria-live="polite">
            <span className="listening-pulse-dot" aria-hidden="true">🔴</span>
            <span className="listening-text">{t('assistant.voice_listening') || 'Listening... Speak now'}</span>
            <button type="button" className="btn ghost btn-sm btn-stop-listening" onClick={handleToggleListen}>
              {t('assistant.voice_stop_listening') || 'Stop listening'}
            </button>
          </div>
        )}

        {/* Processing Voice Active Bar */}
        {isProcessingVoice && (
          <div className="assistant-listening-bar assistant-processing-bar" role="status" aria-live="polite">
            <span className="listening-pulse-dot" aria-hidden="true">⏳</span>
            <span className="listening-text">{t('assistant.voice_processing') || 'Processing speech offline...'}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="assistant-error-banner" role="alert">
            <span>⚠️ {error}</span>
            <button type="button" className="btn-text-close" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Input Bar */}
        <form
          className="assistant-input-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <div className="assistant-input-wrapper">
            <label htmlFor="assistant-user-input" className="sr-only">
              {t('assistant.input_label') || 'Ask a cybersecurity question'}
            </label>
            <input
              id="assistant-user-input"
              type="text"
              className="assistant-text-input"
              placeholder={t('assistant.input_placeholder') || 'Ask about links, passwords, Telebirr scams, or reporting...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              maxLength={1000}
              autoComplete="off"
            />
            <button
              type="button"
              className={`btn ghost assistant-mic-btn ${isListening ? 'listening-pulse' : ''}`}
              onClick={handleToggleListen}
              disabled={loading}
              title={isListening ? (t('assistant.voice_stop_listening') || 'Stop listening') : (t('assistant.voice_mic_btn') || 'Voice Input')}
              aria-label={isListening ? (t('assistant.voice_stop_listening') || 'Stop listening') : (t('assistant.voice_mic_btn') || 'Voice Input')}
              aria-pressed={isListening}
            >
              <span aria-hidden="true">{isListening ? '🛑' : '🎙️'}</span>
            </button>
            <button
              type="submit"
              className="btn btn-primary assistant-send-btn"
              disabled={loading || !input.trim()}
              aria-label={t('assistant.send_btn') || 'Send message'}
            >
              {loading ? '⏳' : '➤'}
            </button>
          </div>
        </form>

        {/* Security & Educational Disclaimer Note */}
        <div className="assistant-footer-disclaimer">
          <p className="small text-muted">
            ℹ️ {t('assistant.disclaimer_footer') || 'Educational guidance only. CyberShield AI Assistant does not perform live URL scanning or guarantee safety.'}
          </p>
        </div>
      </div>
    </div>
  )
}

