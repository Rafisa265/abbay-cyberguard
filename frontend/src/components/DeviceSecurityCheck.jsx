import { useEffect, useState, useCallback, useRef } from 'react'
import { getDeviceSecurityStatus, scanDeviceSecurity, synthesizeSpeechOffline } from '../lib/api.js'
import { generateDeviceSecurityPdfBlob, formatReportForSpeech, localizeFinding, localizeLimitation, formatLocalizedRating } from '../lib/deviceSecurityReport.js'

export default function DeviceSecurityCheck({ t, onNavigate, lang }) {
  const activeLang = (lang || (typeof document !== 'undefined' ? document.documentElement.lang : 'en') || 'en').toLowerCase()

  const [target, setTarget] = useState('windows')
  const [consentGranted, setConsentGranted] = useState(false)
  const [runQuickScan, setRunQuickScan] = useState(false)
  const [state, setState] = useState('idle') // idle, scanning, success, error
  const [result, setResult] = useState(null)
  const [errorDetails, setErrorDetails] = useState(null)
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [expandedEvidence, setExpandedEvidence] = useState({})
  const [backendStatus, setBackendStatus] = useState('checking') // checking, connected, unreachable
  const [androidReadiness, setAndroidReadiness] = useState(null)
  const [reportActionMsg, setReportActionMsg] = useState(null)

  // Voice speech state
  const [speechState, setSpeechState] = useState('idle') // idle, loading, playing, paused
  const [voiceNotice, setVoiceNotice] = useState(null)
  const activeAudioRef = useRef(null)

  // Notification & Alert system
  const [alertHistory, setAlertHistory] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set())
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [showAlertHistory, setShowAlertHistory] = useState(false)
  const lastAlertTimestamps = useRef({})

  // Browser environment (client-side only, no backend needed)
  const browserInfo = useRef((() => {
    if (typeof navigator === 'undefined') return null
    const ua = navigator.userAgent
    let browserName = 'Unknown'
    let browserVersion = ''
    if (ua.includes('Edg/')) { browserName = 'Microsoft Edge'; browserVersion = ua.match(/Edg\/(\S+)/)?.[1] || '' }
    else if (ua.includes('Chrome/')) { browserName = 'Google Chrome'; browserVersion = ua.match(/Chrome\/(\S+)/)?.[1] || '' }
    else if (ua.includes('Firefox/')) { browserName = 'Mozilla Firefox'; browserVersion = ua.match(/Firefox\/(\S+)/)?.[1] || '' }
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) { browserName = 'Safari'; browserVersion = ua.match(/Version\/(\S+)/)?.[1] || '' }
    return {
      name: browserName,
      version: browserVersion,
      platform: navigator.platform || 'Unknown',
      language: navigator.language || 'en',
      cookiesEnabled: navigator.cookieEnabled,
      isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
      onLine: navigator.onLine,
    }
  })())

  // Fetch initial readiness status
  const checkStatus = useCallback(() => {
    setBackendStatus('checking')
    setErrorDetails(null)
    getDeviceSecurityStatus()
      .then((data) => {
        if (!data || data.connected === false || data.status === 502) {
          setBackendStatus('unreachable')
          return
        }
        setBackendStatus('connected')
        if (data.android_status) {
          setAndroidReadiness(data.android_status)
        }
        if (data.host_platform && data.host_platform !== 'Windows') {
          setTarget('android')
        }
      })
      .catch(() => {
        setBackendStatus('unreachable')
      })
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Stop any active speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
        activeAudioRef.current = null
      }
    }
  }, [])

  const handleStartScan = useCallback(async () => {
    if (backendStatus === 'unreachable') {
      setErrorDetails({
        category: t?.('device.backend_unreachable_title') || 'Backend Unreachable (Port 8000)',
        message: t?.('device.backend_unreachable') || 'Cannot connect to CyberShield backend at http://127.0.0.1:8000 (HTTP 502 Bad Gateway). Please run start.bat or cd backend && python run.py.',
        status: 502,
      })
      setState('error')
      return
    }

    if (!consentGranted) {
      setErrorDetails({
        category: 'Consent Required',
        message: 'Explicit user authorization is mandatory before running local security checks.',
      })
      setState('error')
      return
    }

    // Stop speech before new assessment
    handleStopSpeech()
    setState('scanning')
    setErrorDetails(null)
    setReportActionMsg(null)

    try {
      const data = await scanDeviceSecurity({
        target,
        run_quick_scan: runQuickScan && target === 'windows',
        consent: true,
      })
      setResult(data)
      setState('success')
      processAlerts(data)
    } catch (err) {
      if (err.status === 502 || err.code === 'BACKEND_UNREACHABLE') {
        setBackendStatus('unreachable')
        setErrorDetails({
          category: t?.('device.backend_unreachable_title') || 'Backend Unreachable (Port 8000)',
          message: t?.('device.backend_unreachable') || 'Could not connect to CyberShield backend at http://127.0.0.1:8000 (HTTP 502 Bad Gateway). Please verify that the backend process is running.',
          status: 502,
        })
      } else {
        setErrorDetails({
          category: err.code || 'Scan Failed',
          message: err.detail || err.message || 'Failed to complete device security check.',
          status: err.status,
        })
      }
      setState('error')
    }
  }, [target, consentGranted, runQuickScan, backendStatus, t])

  // PDF Export
  const handleDownloadPdf = () => {
    if (!result) return
    try {
      const blob = generateDeviceSecurityPdfBlob(result, { language: activeLang, t })
      if (!blob) throw new Error('PDF generation produced empty blob')
      const todayIso = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CyberShield_Device_Security_${todayIso}_${target.toUpperCase()}_${activeLang.toUpperCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setReportActionMsg({ type: 'success', text: t?.('device.pdf_download_success') || 'PDF report downloaded successfully.' })
    } catch (err) {
      setReportActionMsg({ type: 'error', text: `${t?.('device.pdf_download_error') || 'Failed to generate PDF report'}: ${err.message}` })
    }
  }

  // Speech: Play Aloud
  const handleReadAloud = async () => {
    if (!result) return
    handleStopSpeech()

    const speechText = formatReportForSpeech(result, activeLang)
    if (!speechText) return

    setSpeechState('loading')
    setVoiceNotice(null)

    // English: synthesize via browser SpeechSynthesis
    if (activeLang === 'en') {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        setVoiceNotice(t?.('device.voice_not_supported') || 'Browser speech synthesis is not supported on this platform.')
        setSpeechState('idle')
        return
      }
      const utterance = new SpeechSynthesisUtterance(speechText)
      utterance.lang = 'en-US'
      utterance.rate = 0.95
      utterance.onend = () => setSpeechState('idle')
      utterance.onerror = () => setSpeechState('idle')
      window.speechSynthesis.speak(utterance)
      setSpeechState('playing')
      setVoiceNotice('🔊 ' + (t?.('device.voice_reading_en') || 'Reading assessment report via local English speech engine.'))
      return
    }

    // Afaan Oromoo ('om') or Amharic ('am'): synthesize via offline backend MMS VITS
    try {
      const synthRes = await synthesizeSpeechOffline({ text: speechText, language: activeLang })
      if (synthRes && synthRes.audioUrl) {
        const audio = new Audio(synthRes.audioUrl)
        activeAudioRef.current = audio
        audio.onended = () => {
          setSpeechState('idle')
          activeAudioRef.current = null
        }
        audio.onerror = () => {
          setSpeechState('idle')
          activeAudioRef.current = null
          setVoiceNotice(t?.('device.voice_audio_error') || 'Audio playback encountered an error.')
        }
        await audio.play()
        setSpeechState('playing')
        const engineLabel = activeLang === 'am' ? 'Offline Amharic MMS VITS' : 'Offline Afaan Oromoo MMS VITS'
        const voiceTemplate = t?.('device.voice_reading_offline') || 'Reading report via {engine} (100% on-device).'
        setVoiceNotice('🔊 ' + voiceTemplate.replace('{engine}', engineLabel))
      } else if (synthRes && synthRes.error) {
        setSpeechState('idle')
        setVoiceNotice(synthRes.error.message || t?.('device.voice_synth_error') || 'Voice synthesis unavailable.')
      } else {
        setSpeechState('idle')
        setVoiceNotice(t?.('device.voice_synth_error') || 'Voice synthesis failed to produce audio.')
      }
    } catch (err) {
      setSpeechState('idle')
      setVoiceNotice(`Speech synthesis error: ${err.message}`)
    }
  }

  // Speech: Pause
  const handlePauseSpeech = () => {
    if (activeLang === 'en' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause()
      setSpeechState('paused')
    } else if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      setSpeechState('paused')
    }
  }

  // Speech: Resume
  const handleResumeSpeech = () => {
    if (activeLang === 'en' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume()
      setSpeechState('playing')
    } else if (activeAudioRef.current) {
      activeAudioRef.current.play()
      setSpeechState('playing')
    }
  }

  // Speech: Stop
  const handleStopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current.currentTime = 0
      activeAudioRef.current = null
    }
    setSpeechState('idle')
  }

  // --- Notification System Helpers ---
  const handleRequestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return
    try {
      const perm = await Notification.requestPermission()
      setNotifPermission(perm)
    } catch { /* ignore */ }
  }

  const processAlerts = (scanResult) => {
    if (!scanResult?.findings) return
    const now = Date.now()
    const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour duplicate suppression

    const newAlerts = []
    for (const finding of scanResult.findings) {
      if (finding.status !== 'FAIL' && finding.status !== 'WARNING') continue
      const alertKey = `${finding.id}-${finding.status}`

      // Skip dismissed
      if (dismissedAlerts.has(alertKey)) continue

      // Duplicate suppression with 1-hour cooldown
      const lastSeen = lastAlertTimestamps.current[alertKey]
      if (lastSeen && (now - lastSeen) < COOLDOWN_MS) continue

      lastAlertTimestamps.current[alertKey] = now
      newAlerts.push({
        id: alertKey,
        findingId: finding.id,
        name: finding.name,
        status: finding.status,
        severity: finding.severity,
        category: finding.category,
        timestamp: new Date().toISOString(),
        dismissed: false,
      })
    }

    if (newAlerts.length > 0) {
      setAlertHistory((prev) => [...newAlerts, ...prev].slice(0, 50))

      // Browser notification for critical findings
      if (notifPermission === 'granted') {
        const criticals = newAlerts.filter((a) => a.status === 'FAIL')
        if (criticals.length > 0) {
          try {
            new Notification('ABBAY CYBERGUARD — Security Alert', {
              body: `${criticals.length} finding(s) require attention: ${criticals.map(a => a.name).join(', ')}`,
              icon: '/favicon.ico',
              tag: 'cyberguard-device-alert',
            })
          } catch { /* Notification API may fail silently */ }
        }
      }
    }
  }

  const handleDismissAlert = (alertKey) => {
    setDismissedAlerts((prev) => new Set([...prev, alertKey]))
    setAlertHistory((prev) => prev.map((a) => a.id === alertKey ? { ...a, dismissed: true } : a))
  }

  const handleClearAlertHistory = () => {
    setAlertHistory([])
    setDismissedAlerts(new Set())
    lastAlertTimestamps.current = {}
  }

  // Capability inventory for honest transparency
  const CAPABILITY_INVENTORY = [
    { name: 'Windows Defender / Antivirus', method: 'Registry (winreg)', status: 'SUPPORTED', scope: 'Engine version, signatures, real-time protection' },
    { name: 'Firewall (3 profiles)', method: 'Registry (winreg)', status: 'SUPPORTED', scope: 'Domain, Private, Public profile status + MpsSvc service' },
    { name: 'OS Security Updates', method: 'Registry (CBS)', status: 'SUPPORTED', scope: 'Cumulative update age vs 45/90 day threshold' },
    { name: 'UAC System Hardening', method: 'Registry (winreg)', status: 'SUPPORTED', scope: 'EnableLUA privilege boundary' },
    { name: 'Disk Encryption (BitLocker)', method: 'Registry (winreg)', status: 'SUPPORTED', scope: 'Policy and encryption method (non-admin may be limited)' },
    { name: 'Screen Lock / Screensaver', method: 'Registry (winreg)', status: 'SUPPORTED', scope: 'Timeout and password-on-resume policy' },
    { name: 'Startup Persistence Entries', method: 'Registry (Run/RunOnce)', status: 'SUPPORTED', scope: 'HKCU + HKLM Run/RunOnce keys (read-only, names only)' },
    { name: 'Running Process Monitoring', method: 'psutil (if installed)', status: 'PARTIAL', scope: 'Process count only. Requires pip install psutil for detailed audit.' },
    { name: 'Browser Environment', method: 'Client-side JS (navigator)', status: 'SUPPORTED', scope: 'Browser name, version, platform, cookies, secure context' },
    { name: 'Android Device (ADB)', method: 'ADB subprocess', status: 'SUPPORTED', scope: 'Requires ADB installed + USB debugging authorized' },
    { name: 'Network Traffic Analysis', method: '—', status: 'NOT AVAILABLE', scope: 'Not implemented. Use network monitoring tools externally.' },
    { name: 'File System Malware Scan', method: 'Defender MpCmdRun.exe', status: 'PARTIAL', scope: 'Quick scan or single-file scan (user-initiated only, -DisableRemediation)' },
  ]

  // Remediation settings shortcuts for Windows
  const REMEDIATION_SHORTCUTS = {
    'DEF-ENGINE': 'ms-settings:windowsdefender',
    'DEF-SIGS': 'ms-settings:windowsdefender',
    'DEF-RTP': 'ms-settings:windowsdefender',
    'FW-DOMAIN': 'ms-settings:windowsdefender-firewall',
    'FW-PRIVATE': 'ms-settings:windowsdefender-firewall',
    'FW-PUBLIC': 'ms-settings:windowsdefender-firewall',
    'UPD-CBS': 'ms-settings:windowsupdate',
    'HARD-UAC': 'ms-settings:signinoptions',
    'ENC-BITLOCKER': 'ms-settings:deviceencryption',
    'LOCK-SCREEN': 'ms-settings:lockscreen',
  }

    const toggleEvidence = (id) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const findings = result?.findings || []
  const filteredFindings = findings.filter((f) => {
    if (activeFilter === 'ALL') return true
    if (activeFilter === 'PASS') return f.status === 'PASS'
    if (activeFilter === 'WARNING') return f.status === 'WARNING'
    if (activeFilter === 'FAIL') return f.status === 'FAIL'
    if (activeFilter === 'UNSUPPORTED') return f.status === 'NOT SUPPORTED' || f.status === 'NOT CHECKED'
    return f.category === activeFilter
  })

  return (
    <section className="module-container" aria-label="Device Security Check">
      {/* Module Header Box */}
      <div className="module-header-box" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div className="module-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="module-tag" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {t?.('device.tag_defense') || 'LOCAL DEVICE DEFENSE'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🔒 {t?.('device.tag_zero_telemetry') || '100% On-Device / Zero Telemetry'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: '8px 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>💻</span>
            <span>{t?.('device.title') || 'Device Security Check & Defense Assessment'}</span>
          </h1>

          <p className="lead" style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: '8px 0 16px 0', maxWidth: '780px' }}>
            {t?.('device.desc') || 'Audit local Microsoft Defender status, real-time protection, firewall configuration, security patch currency, and mobile device hygiene without sending sensitive data to external servers.'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', color: '#6ee7b7' }}>
              🛡️ {t?.('device.tag_read_only') || 'Read-Only Assessment (No settings altered)'}
            </div>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', color: '#a5b4fc' }}>
              🇪🇹 {t?.('device.tag_ethiopian_baseline') || 'Ethiopian Cyber Defense Baseline'}
            </div>
          </div>
        </div>
      </div>

      {/* Backend Offline Warning Banner */}
      {backendStatus === 'unreachable' && (
        <div className="card" role="alert" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontWeight: 'bold', fontSize: '1rem' }}>
              <span>⚠️</span>
              <span>{t?.('device.backend_unreachable_title') || 'Backend Service Unreachable (HTTP 502 / Port 8000)'}</span>
            </div>
            <p style={{ margin: '6px 0 0 28px', fontSize: '0.85rem', color: '#fca5a5' }}>
              {t?.('device.backend_unreachable') || 'Cannot connect to CyberShield backend at http://127.0.0.1:8000. Ensure the backend server is running via start.bat or cd backend && python run.py.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={checkStatus}
            style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px', color: '#f87171', borderColor: '#ef4444' }}
          >
            🔄 {t?.('device.retry_conn') || 'Retry Connection'}
          </button>
        </div>
      )}

      {/* Configuration & Controls Card */}
      <div className="card" style={{ padding: '20px', borderRadius: '12px', marginBottom: '24px', background: '#1e293b', border: '1px solid #334155' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>
          🎯 {t?.('device.select_target_title') || 'Select Assessment Target & Authorization'}
        </h2>

        {/* Target Platform Selector */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${target === 'windows' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setTarget('windows'); setErrorDetails(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px' }}
          >
            <span>🪟</span>
            <span>{t?.('device.target_windows_desc') || t?.('device.target_windows') || 'Windows Host Security'}</span>
          </button>

          <button
            type="button"
            className={`btn ${target === 'android' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setTarget('android'); setErrorDetails(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px' }}
          >
            <span>📱</span>
            <span>{t?.('device.target_android_desc') || t?.('device.target_android') || 'Android Mobile Check (ADB)'}</span>
          </button>
        </div>

        {/* Platform Info Box */}
        {target === 'windows' ? (
          <div style={{ background: 'rgba(51, 65, 85, 0.5)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <strong>{t?.('device.scope_windows_label') || 'Windows Inspection Scope:'}</strong>{' '}
            {t?.('device.scope_windows_desc') || 'Queries local registry for Microsoft Defender engine & signature freshness, recent scan telemetry, real-time protection policy, host firewall profiles (Domain, Private, Public), firewall service configuration (MpsSvc), CBS cumulative update currency, and UAC privilege boundary.'}
          </div>
        ) : (
          <div style={{ background: 'rgba(51, 65, 85, 0.5)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <strong>{t?.('device.scope_android_label') || 'Android Inspection Scope:'}</strong>{' '}
            {t?.('device.scope_android_desc') || 'Inspects attached mobile device via Android Debug Bridge (ADB). Audits OS version, security patch level, device firmware identity, bootloader lock state, Verified Boot (AVB), screen lock enforcement, unknown-source APK restrictions, and application hygiene.'}
            {androidReadiness?.adb_state === 'MISSING' && (
              <div style={{ marginTop: '8px', color: '#fbbf24', fontWeight: 600 }}>
                ⚠️ {t?.('device.adb_missing') || 'ADB is not installed. Android assessment is unavailable on this computer.'}
              </div>
            )}
            {androidReadiness?.adb_state === 'NO_DEVICE' && (
              <div style={{ marginTop: '8px', color: '#60a5fa', fontWeight: 600 }}>
                ℹ️ {t?.('device.no_device') || 'No Android device detected. Connect an authorized Android device to continue.'}
              </div>
            )}
            {androidReadiness?.adb_state === 'UNAUTHORIZED' && (
              <div style={{ marginTop: '8px', color: '#f87171', fontWeight: 600 }}>
                ⚠️ {t?.('device.auth_pending') || 'Android device detected, but USB debugging authorization is pending.'}
              </div>
            )}
          </div>
        )}

        {/* User Consent & Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: '#f8fafc' }}>
            <input
              type="checkbox"
              checked={consentGranted}
              onChange={(e) => setConsentGranted(e.target.checked)}
              style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span>
              <strong>{t?.('device.consent_title') || 'I authorize CyberShield to inspect local security configuration.'}</strong>{' '}
              {t?.('device.consent_desc') || 'I understand this check is completely local, non-destructive, and will not alter settings, delete files, or disable defenses.'}
            </span>
          </label>

          {target === 'windows' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8', marginLeft: '28px' }}>
              <input
                type="checkbox"
                checked={runQuickScan}
                disabled={!consentGranted}
                onChange={(e) => setRunQuickScan(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>
                {t?.('device.optional_quick_scan') || 'Optional: Execute Microsoft Defender Quick Scan (audits memory and startup processes; takes ~1-3 minutes).'}
              </span>
            </label>
          )}
        </div>

        {/* Start Button */}
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartScan}
            disabled={!consentGranted || state === 'scanning' || backendStatus === 'unreachable'}
            style={{
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '1rem',
              borderRadius: '8px',
              cursor: consentGranted && state !== 'scanning' && backendStatus !== 'unreachable' ? 'pointer' : 'not-allowed',
              opacity: consentGranted && state !== 'scanning' && backendStatus !== 'unreachable' ? 1 : 0.6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {state === 'scanning' ? (
              <>
                <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                <span>{t?.('device.btn_scanning') || 'Performing Security Assessment...'}</span>
              </>
            ) : (
              <>
                <span>🛡️</span>
                <span>{t?.('device.btn_run') || 'Run Device Security Assessment'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {state === 'error' && errorDetails && (
        <div className="card" role="alert" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontWeight: 'bold' }}>
            <span>⚠️</span>
            <span>{errorDetails.category}</span>
          </div>
          <p style={{ margin: '8px 0 0 26px', fontSize: '0.85rem', color: '#fca5a5' }}>
            {errorDetails.message}
          </p>
        </div>
      )}

      {/* Results Dashboard */}
      {result && (
        <div className="card" style={{ padding: '24px', borderRadius: '16px', background: '#1e293b', border: '1px solid #334155' }}>
          {/* Device Summary & Overall Status Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid #334155', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t?.('device.device_id_masked') || 'DEVICE IDENTIFICATION (PRIVACY MASKED)'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span>{target === 'windows' ? '💻' : '📱'}</span>
                <span>{result.device_summary?.hostname || result.device_summary?.model || t?.('device.device_default') || 'Device'}</span>
                <span style={{ fontSize: '0.75rem', background: '#334155', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>
                  {result.device_summary?.os || t?.('device.host_os_default') || 'Host OS'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                {t?.('device.last_audit') || 'Last Audit'}: {new Date(result.scan_time).toLocaleString()} | {t?.('device.architecture') || 'Architecture'}: {result.device_summary?.architecture || 'ARM/x64'}
              </div>
            </div>

            {/* Overall Rating Shield */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t?.('device.verified_status_label') || 'VERIFIED SYSTEM STATUS'}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: result.overall_status === 'PASS' ? '#34d399' : result.overall_status === 'WARNING' ? '#fbbf24' : result.overall_status === 'FAIL' ? '#f87171' : '#a78bfa' }}>
                  {formatLocalizedRating(result.overall_rating, t)}
                </div>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                background: result.overall_status === 'PASS' ? 'rgba(52, 211, 153, 0.2)' : result.overall_status === 'WARNING' ? 'rgba(251, 191, 36, 0.2)' : result.overall_status === 'FAIL' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(167, 139, 250, 0.2)',
                border: `2px solid ${result.overall_status === 'PASS' ? '#34d399' : result.overall_status === 'WARNING' ? '#fbbf24' : result.overall_status === 'FAIL' ? '#f87171' : '#a78bfa'}`,
              }}>
                {result.overall_status === 'PASS' ? '🛡️' : result.overall_status === 'WARNING' ? '⚠️' : result.overall_status === 'FAIL' ? '🚨' : '❓'}
              </div>
            </div>
          </div>

          {/* Action Strip: PDF Download & Read Report Aloud */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', padding: '14px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', border: '1px solid #334155' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadPdf}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem' }}
            >
              <span>📄</span>
              <span>{t?.('device.download_pdf') || 'Download PDF Report'}</span>
            </button>

            {/* Read Aloud Controls */}
            {speechState === 'idle' && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleReadAloud}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', fontSize: '0.9rem', color: '#60a5fa', borderColor: '#3b82f6' }}
              >
                <span>🔊</span>
                <span>{t?.('device.read_aloud') || 'Read Report Aloud'}</span>
              </button>
            )}

            {speechState === 'loading' && (
              <button
                type="button"
                className="btn btn-outline"
                disabled
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', fontSize: '0.9rem', opacity: 0.7 }}
              >
                <span className="spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                <span>{t?.('device.synthesizing_voice') || 'Synthesizing Voice...'}</span>
              </button>
            )}

            {speechState === 'playing' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePauseSpeech}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  <span>⏸️</span>
                  <span>{t?.('device.pause_voice') || 'Pause'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleStopSpeech}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', color: '#f87171', borderColor: '#ef4444' }}
                >
                  <span>⏹️</span>
                  <span>{t?.('device.stop_voice') || 'Stop'}</span>
                </button>
              </div>
            )}

            {speechState === 'paused' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleResumeSpeech}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  <span>▶️</span>
                  <span>{t?.('device.resume_voice') || 'Resume'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleStopSpeech}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', color: '#f87171', borderColor: '#ef4444' }}
                >
                  <span>⏹️</span>
                  <span>{t?.('device.stop_voice') || 'Stop'}</span>
                </button>
              </div>
            )}

            {voiceNotice && (
              <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontStyle: 'italic', marginLeft: 'auto' }}>
                {voiceNotice}
              </span>
            )}

            {reportActionMsg && (
              <span style={{ fontSize: '0.8rem', color: reportActionMsg.type === 'success' ? '#34d399' : '#f87171', marginLeft: 'auto' }}>
                {reportActionMsg.text}
              </span>
            )}
          </div>

          {/* Metrics Pill Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <span style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
              ✓ {result.metrics?.pass_count || 0} {t?.('device.status_pass') || 'PASS'}
            </span>
            <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
              ⚠️ {result.metrics?.warning_count || 0} {t?.('device.status_warning') || 'WARNING'}
            </span>
            <span style={{ background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.4)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
              ✗ {result.metrics?.fail_count || 0} {t?.('device.status_fail') || 'FAIL'}
            </span>
            <span style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.4)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
              🚫 {result.metrics?.not_supported_count || 0} {t?.('device.status_not_supported') || 'NOT SUPPORTED'}
            </span>
            <span style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.4)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
              ❓ {result.metrics?.not_checked_count || 0} {t?.('device.status_not_checked') || 'NOT CHECKED'}
            </span>
          </div>

          {/* Monitoring Status Banner — honest "on-demand only" */}
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px', fontSize: '0.82rem', color: '#a5b4fc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong>📋 {t?.('device.monitoring_type') || 'On-Demand Check Only'}</strong> — {t?.('device.monitoring_disclaimer') || 'This is not continuous real-time monitoring. Results reflect the state at the time of the last scan.'}
              <span style={{ display: 'block', marginTop: '2px', color: '#818cf8', fontSize: '0.78rem' }}>
                {t?.('device.last_checked') || 'Last checked'}: {result?.scan_time ? new Date(result.scan_time).toLocaleString() : '—'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleStartScan}
              disabled={!consentGranted || state === 'scanning'}
              style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '6px', color: '#818cf8', borderColor: '#6366f1' }}
            >
              🔄 {t?.('device.check_now') || 'Check Now'}
            </button>
          </div>

          {/* Overall Assessment Card — never shows "100% Secure" */}
          <div style={{ marginBottom: '16px', padding: '14px', background: result.overall_status === 'PASS' ? 'rgba(52, 211, 153, 0.08)' : result.overall_status === 'WARNING' ? 'rgba(251, 191, 36, 0.08)' : 'rgba(248, 113, 113, 0.08)', border: `1px solid ${result.overall_status === 'PASS' ? 'rgba(52, 211, 153, 0.3)' : result.overall_status === 'WARNING' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`, borderRadius: '10px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: result.overall_status === 'PASS' ? '#34d399' : result.overall_status === 'WARNING' ? '#fbbf24' : '#f87171', marginBottom: '6px' }}>
              {result.overall_status === 'PASS' ? '🛡️' : result.overall_status === 'WARNING' ? '⚠️' : '🚨'}{' '}
              {t?.('device.overall_assessment') || 'Overall Assessment'}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
              {result.overall_status === 'PASS'
                ? `${t?.('device.overall_pass') || 'All checked controls passed.'} ${(result.metrics?.not_checked_count || 0) + (result.metrics?.not_supported_count || 0) > 0 ? (t?.('device.overall_pass_caveat') || `However, ${(result.metrics?.not_checked_count || 0) + (result.metrics?.not_supported_count || 0)} check(s) could not be verified due to platform limitations.`) : ''}`
                : result.overall_status === 'WARNING'
                  ? t?.('device.overall_warning') || 'Some checks require attention or could not be fully verified. Review the findings below.'
                  : t?.('device.overall_fail') || 'Critical security issues detected. Review and address the FAIL findings below.'}
            </p>
          </div>

          {/* Browser Environment (client-side, no backend needed) */}
          {browserInfo.current && (
            <div style={{ marginBottom: '16px', padding: '14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🌐 {t?.('device.browser_environment') || 'Browser Environment'}{' '}
                <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px' }}>
                  {t?.('device.client_side_only') || 'Client-side detection only'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ color: '#94a3b8' }}>Browser: <strong style={{ color: '#f8fafc' }}>{browserInfo.current.name} {browserInfo.current.version?.split('.')[0]}</strong></div>
                <div style={{ color: '#94a3b8' }}>Platform: <strong style={{ color: '#f8fafc' }}>{browserInfo.current.platform}</strong></div>
                <div style={{ color: '#94a3b8' }}>Secure Context: <strong style={{ color: browserInfo.current.isSecureContext ? '#34d399' : '#f87171' }}>{browserInfo.current.isSecureContext ? '✓ Yes' : '✗ No'}</strong></div>
                <div style={{ color: '#94a3b8' }}>Cookies: <strong style={{ color: browserInfo.current.cookiesEnabled ? '#34d399' : '#f87171' }}>{browserInfo.current.cookiesEnabled ? '✓ Enabled' : '✗ Disabled'}</strong></div>
                <div style={{ color: '#94a3b8' }}>Language: <strong style={{ color: '#f8fafc' }}>{browserInfo.current.language}</strong></div>
                <div style={{ color: '#94a3b8' }}>Online: <strong style={{ color: browserInfo.current.onLine ? '#34d399' : '#f87171' }}>{browserInfo.current.onLine ? '✓ Yes' : '✗ Offline'}</strong></div>
              </div>
            </div>
          )}

          {/* Notification & Alert System */}
          <div style={{ marginBottom: '16px', padding: '14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                🔔 {t?.('device.alert_notifications') || 'Alert Notifications'}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {notifPermission !== 'granted' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleRequestNotifPermission}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', color: '#60a5fa', borderColor: '#3b82f6' }}
                  >
                    🔔 {t?.('device.enable_notifications') || 'Enable Browser Notifications'}
                  </button>
                )}
                {notifPermission === 'granted' && (
                  <span style={{ fontSize: '0.75rem', color: '#34d399' }}>
                    ✓ {t?.('device.notifications_enabled') || 'Browser notifications enabled'}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm ghost"
                  onClick={() => setShowAlertHistory(!showAlertHistory)}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                >
                  {showAlertHistory ? '▴ Hide' : `▾ ${t?.('device.alert_history') || 'Alert History'} (${alertHistory.length})`}
                </button>
              </div>
            </div>
            {showAlertHistory && (
              <div>
                {alertHistory.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0' }}>
                    {t?.('device.no_alerts') || 'No alerts recorded. Run an assessment to detect potential issues.'}
                  </p>
                ) : (
                  <>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {alertHistory.slice(0, 10).map((alert, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#1e293b', borderRadius: '6px', fontSize: '0.78rem', opacity: alert.dismissed ? 0.5 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: alert.status === 'FAIL' ? '#f87171' : '#fbbf24', fontWeight: 'bold' }}>
                              {alert.status === 'FAIL' ? '🚨' : '⚠️'} {alert.severity}
                            </span>
                            <span style={{ color: '#f8fafc' }}>{alert.name}</span>
                            <span style={{ color: '#64748b' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {!alert.dismissed && (
                            <button
                              type="button"
                              onClick={() => handleDismissAlert(alert.id)}
                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.72rem' }}
                            >
                              ✕ Dismiss
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm ghost"
                      onClick={handleClearAlertHistory}
                      style={{ marginTop: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#64748b' }}
                    >
                      🗑️ {t?.('device.clear_alerts') || 'Clear Alert History'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['ALL', 'Antivirus', 'Firewall', 'OS Updates', 'System Hardening', 'Disk Encryption', 'Physical Security', 'Startup Persistence', 'Process Monitoring', 'Device State', 'UNSUPPORTED'].map((filter) => {
              const filterLabel = t?.(`device.filter_${filter.toLowerCase().replace(/ /g, '_')}`) || filter
              return (
                <button
                  key={filter}
                  type="button"
                  className={`btn btn-sm ${activeFilter === filter ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setActiveFilter(filter)}
                  style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                >
                  {filterLabel}
                </button>
              )
            })}
          </div>

          {/* Findings Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredFindings.map((rawFinding) => {
              const finding = localizeFinding(rawFinding, activeLang, t)
              const isPass = rawFinding.status === 'PASS'
              const isWarn = rawFinding.status === 'WARNING'
              const isFail = rawFinding.status === 'FAIL'
              const isNotSupp = rawFinding.status === 'NOT SUPPORTED'

              const statusColor = isPass ? '#34d399' : isWarn ? '#fbbf24' : isFail ? '#f87171' : isNotSupp ? '#a78bfa' : '#94a3b8'
              const statusBg = isPass ? 'rgba(52, 211, 153, 0.1)' : isWarn ? 'rgba(251, 191, 36, 0.1)' : isFail ? 'rgba(248, 113, 113, 0.1)' : isNotSupp ? 'rgba(167, 139, 250, 0.1)' : 'rgba(148, 163, 184, 0.1)'

              return (
                <div
                  key={finding.id}
                  style={{
                    background: '#0f172a',
                    border: `1px solid ${statusColor}40`,
                    borderRadius: '12px',
                    padding: '16px',
                    transition: 'border 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', background: '#1e293b', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px' }}>
                        {finding.id}
                      </span>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                        {finding.name}
                      </h3>
                      <span style={{ fontSize: '0.7rem', background: '#1e293b', color: '#cbd5e1', padding: '2px 6px', borderRadius: '4px' }}>
                        {finding.category}
                      </span>
                      {finding.verification_level && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px' }}>
                          {finding.verification_level}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: rawFinding.severity === 'CRITICAL' ? '#f87171' : rawFinding.severity === 'HIGH' ? '#fb923c' : rawFinding.severity === 'MEDIUM' ? '#fbbf24' : '#94a3b8', textTransform: 'uppercase' }}>
                        {finding.severity}
                      </span>
                      <span style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}60`, padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {finding.status}
                      </span>
                    </div>
                  </div>

                  {/* Remediation / Guidance */}
                  <div style={{ margin: '12px 0 8px 0', fontSize: '0.85rem', color: '#e2e8f0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{t?.('device.remediation_label') || 'Remediation:'}</span>
                    <span>{finding.remediation}</span>
                  </div>
                  {/* Why It Matters */}
                  {rawFinding.why_it_matters && (
                    <div style={{ margin: '4px 0 8px 0', fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>ℹ️ Why:</span>
                      <span>{rawFinding.why_it_matters}</span>
                    </div>
                  )}
                  {/* False Positive Warning */}
                  {rawFinding.false_positive_warning && (
                    <div style={{ margin: '4px 0 8px 0', fontSize: '0.78rem', color: '#fbbf24', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span>⚠️</span>
                      <span>{rawFinding.false_positive_warning}</span>
                    </div>
                  )}
                  {/* Windows Settings Shortcut */}
                  {REMEDIATION_SHORTCUTS[rawFinding.id] && (rawFinding.status === 'FAIL' || rawFinding.status === 'WARNING') && (
                    <div style={{ margin: '6px 0' }}>
                      <a
                        href={REMEDIATION_SHORTCUTS[rawFinding.id]}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '6px', color: '#60a5fa', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600 }}
                      >
                        ⚙️ {t?.('device.open_settings') || 'Open Windows Settings'}
                      </a>
                    </div>
                  )}

                  {/* Permission Limitation Note (if present) */}
                  {finding.permission_limitation && (
                    <div style={{ margin: '6px 0', fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️ <em>{t?.('device.boundary_limitation_label') || 'Boundary Limitation:'}</em></span>
                      <span>{finding.permission_limitation}</span>
                    </div>
                  )}

                  {/* Verifiable Evidence Toggle */}
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => toggleEvidence(finding.id)}
                      style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      {expandedEvidence[finding.id] ? (t?.('device.hide_evidence') || 'Hide Verifiable Evidence ▴') : (t?.('device.show_evidence') || 'Show Verifiable Evidence ▾')}
                    </button>

                    {expandedEvidence[finding.id] && (
                      <div style={{ marginTop: '8px', background: '#020617', border: '1px solid #1e293b', borderRadius: '6px', padding: '10px', fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all' }}>
                        {finding.evidence}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Capability Inventory — transparent disclosure of what can/cannot be checked */}
          <div style={{ marginTop: '24px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>📋 {t?.('device.capability_inventory') || 'Capability Inventory'}</strong>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{t?.('device.capability_desc') || 'What this tool can and cannot check'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
              {CAPABILITY_INVENTORY.map((cap) => (
                <div key={cap.name} style={{ padding: '8px 10px', background: '#1e293b', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>{cap.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{cap.scope}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: cap.status === 'SUPPORTED' ? 'rgba(52, 211, 153, 0.15)' : cap.status === 'PARTIAL' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(248, 113, 113, 0.15)', color: cap.status === 'SUPPORTED' ? '#34d399' : cap.status === 'PARTIAL' ? '#fbbf24' : '#f87171' }}>
                    {cap.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Boundaries & Unsupported Disclosures */}
          <div style={{ marginTop: '24px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155', borderRadius: '8px', padding: '14px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <strong style={{ color: '#cbd5e1' }}>{t?.('device.transparency_title') || 'Transparency & Unsupported Capabilities:'}</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {(result.limitations || []).map((lim, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  {localizeLimitation(lim, activeLang, t)}
                </li>
              ))}
              <li>{t?.('device.safety_principles_note') || 'CyberShield adheres to non-elevated safety principles: it will never ask for root/SYSTEM permissions or modify registry settings automatically.'}</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
