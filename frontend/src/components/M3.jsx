import { useMemo, useState } from 'react'
import {
  TYPES,
  METHODS,
  LOSSES,
  validate,
  buildDraft,
  sensitiveFlags,
  validChannel,
  triageIncident,
  sortTimelineEvents,
  generateReportPdfBlob,
  predictIncidentType,
  INCIDENT_CATEGORIES,
  classifyIncidentCategory,
  PLATFORM_RECOVERY_GUIDES,
  getEmergencyContainmentActions,
  RECOVERY_SCAM_FLAGS,
  OFFICIAL_REPORTING_DIRECTORY,
  filterReportingDirectory,
  professionalizeIncidentText,
  translateInstitutionalContent,
  INSTITUTIONAL_PROFILES,
  buildInstitutionalReport,
  auditReportQuality,
  INCIDENT_ROUTING_PROFILES,
  getRecommendedRouting,
} from '../lib/m3.js'
import channelData from '../data/channels.json'

const EMPTY_FORM = {
  type: '',
  date: '',
  what: '',
  method: '',
  suspect: '',
  loss: '',
  amount: '',
  evidence: '',
  reporter: '',
  timeline: [],
  isOrganization: false,
  orgName: '',
  orgType: '',
  affectedService: '',
  serviceInterrupted: false,
  isOngoing: false,
  contactsAlerted: false,
  evidenceItems: [],
}

export default function M3({ t, lang = 'en', onNavigate }) {
  const [activeTab, setActiveTab] = useState('triage') // 'triage' | 'details' | 'report' | 'directory'
  const [d, setD] = useState(EMPTY_FORM)
  const [errs, setErrs] = useState({})
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [userApproved, setUserApproved] = useState(false)

  // Recovery & Triage state
  const [selectedPlatform, setSelectedPlatform] = useState('facebook')
  const [detectedCategory, setDetectedCategory] = useState(null)
  const [selectedProfileId, setSelectedProfileId] = useState('cert_national')
  const [selectedRoutingIncident, setSelectedRoutingIncident] = useState('bank_fraud')

  // Multilingual Polish & Text Diff state
  const [textPolishedAccepted, setTextPolishedAccepted] = useState(false)
  const [reportLang, setReportLang] = useState(lang)

  // Evidence item creator state
  const [newEvidence, setNewEvidence] = useState({ type: 'screenshot', description: '', source: '' })

  // Directory search/filter state
  const [dirSearch, setDirSearch] = useState('')
  const [dirCategory, setDirCategory] = useState('all')
  const [dirScope, setDirScope] = useState('all')

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const channels = channelData.filter(validChannel)

  // ML 18-Feature Softmax prediction (Legacy model preserved)
  const mlSuggestion = useMemo(() => predictIncidentType(d.what), [d.what])

  // Category classifier (15 categories)
  const activeCategory = useMemo(() => {
    if (detectedCategory) return detectedCategory
    if (d.what && d.what.trim().length > 10) {
      return classifyIncidentCategory(d.what)
    }
    return d.type ? d.type : 'social_media_compromise'
  }, [detectedCategory, d.what, d.type])

  const categoryMetadata = useMemo(() => {
    return INCIDENT_CATEGORIES.find((c) => c.id === activeCategory) || INCIDENT_CATEGORIES[0]
  }, [activeCategory])

  // Intelligent Incident-Based Routing Profile
  const routingRec = useMemo(() => {
    return getRecommendedRouting(selectedRoutingIncident || d.what)
  }, [selectedRoutingIncident, d.what])

  // Emergency containment actions
  const emergencyActions = useMemo(() => {
    return getEmergencyContainmentActions(activeCategory)
  }, [activeCategory])

  // Platform recovery guide
  const recoveryGuide = useMemo(() => {
    return PLATFORM_RECOVERY_GUIDES[selectedPlatform] || PLATFORM_RECOVERY_GUIDES.facebook
  }, [selectedPlatform])

  // Polished text synthesis
  const polishedTextResult = useMemo(() => {
    return professionalizeIncidentText(d.what, reportLang)
  }, [d.what, reportLang])

  // Flags & Triage
  const flags = useMemo(() => (draft ? sensitiveFlags(draft) : []), [draft])
  const triage = useMemo(() => triageIncident(d, flags), [d, flags])

  // AI Quality Assurance Review
  const qaReview = useMemo(() => {
    return auditReportQuality(d, draft || d.what)
  }, [d, draft])

  // Filtered reporting directory
  const filteredDirectory = useMemo(() => {
    return filterReportingDirectory(dirSearch, dirCategory, dirScope)
  }, [dirSearch, dirCategory, dirScope])

  const setField = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setD((prev) => ({ ...prev, [k]: val }))
    if (errs[k]) {
      setErrs((prev) => ({ ...prev, [k]: null }))
    }
    setUserApproved(false)
  }

  // Handle instant incident analysis in Triage tab
  const handleAnalyzeIncident = () => {
    if (!d.what || d.what.trim().length < 5) return
    const cat = classifyIncidentCategory(d.what)
    setDetectedCategory(cat)

    // Match recommended official reporting destination
    const rec = getRecommendedRouting(d.what)
    if (rec && rec.id) {
      setSelectedRoutingIncident(rec.id)
    }

    // Auto-detect platform if mentioned
    const lower = d.what.toLowerCase()
    if (lower.includes('facebook') || lower.includes('fb')) setSelectedPlatform('facebook')
    else if (lower.includes('instagram')) setSelectedPlatform('instagram')
    else if (lower.includes('whatsapp')) setSelectedPlatform('whatsapp')
    else if (lower.includes('telegram')) setSelectedPlatform('telegram')
    else if (lower.includes('gmail') || lower.includes('google')) setSelectedPlatform('google_gmail')
    else if (lower.includes('outlook') || lower.includes('microsoft') || lower.includes('hotmail')) setSelectedPlatform('microsoft')
    else if (lower.includes('telebirr')) setSelectedPlatform('telebirr')
    else if (lower.includes('cbe') || lower.includes('bank')) setSelectedPlatform('cbe')
  }

  // Timeline handlers
  const handleAddTimelineEvent = () => {
    const count = (d.timeline || []).length + 1
    const newEntry = {
      id: `ev_${Date.now()}_${count}`,
      date: d.date || todayIso,
      time: '',
      description: '',
    }
    setD((prev) => ({
      ...prev,
      timeline: [...(prev.timeline || []), newEntry],
    }))
    setUserApproved(false)
  }

  const handleUpdateTimelineEvent = (id, fieldName, value) => {
    setD((prev) => ({
      ...prev,
      timeline: (prev.timeline || []).map((ev) => (ev.id === id ? { ...ev, [fieldName]: value } : ev)),
    }))
    setUserApproved(false)
  }

  const handleRemoveTimelineEvent = (id) => {
    setD((prev) => ({
      ...prev,
      timeline: (prev.timeline || []).filter((ev) => ev.id !== id),
    }))
    setUserApproved(false)
  }

  // Evidence Item handlers
  const handleAddEvidenceItem = () => {
    if (!newEvidence.description || !newEvidence.description.trim()) return
    const newItem = {
      id: `evd_${Date.now()}`,
      type: newEvidence.type,
      description: newEvidence.description.trim(),
      source: newEvidence.source.trim() || 'Direct User Capture',
      date: todayIso,
    }
    setD((prev) => ({
      ...prev,
      evidenceItems: [...(prev.evidenceItems || []), newItem],
    }))
    setNewEvidence({ type: 'screenshot', description: '', source: '' })
    setUserApproved(false)
  }

  const handleRemoveEvidenceItem = (id) => {
    setD((prev) => ({
      ...prev,
      evidenceItems: (prev.evidenceItems || []).filter((ev) => ev.id !== id),
    }))
    setUserApproved(false)
  }

  // Form submission & Draft generation
  const handleMakeDraft = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const validationErrors = validate(d)
    if (Object.keys(validationErrors).length > 0) {
      setErrs(validationErrors)
      setDraft(null)
      return
    }
    setErrs({})

    // Build comprehensive institutional 14-section report
    const effectiveDescription = textPolishedAccepted && polishedTextResult.corrected
      ? polishedTextResult.corrected
      : d.what

    const reportData = {
      ...d,
      description: effectiveDescription,
      incidentType: d.type || categoryMetadata.id,
      incidentDate: d.date || todayIso,
      severity: categoryMetadata.severity,
    }

    const institutionalDoc = buildInstitutionalReport(reportData, selectedProfileId, reportLang)
    setDraft(institutionalDoc)
    setActiveTab('report')
  }

  // Export handlers
  const copyReportText = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft)
      setMsg(t('m3.action.copied_success') || 'Report text copied to clipboard successfully!')
    } catch {
      // Fallback
      setMsg(t('m3.action.copied_success') || 'Report copied!')
    }
  }

  const downloadText = () => {
    if (!draft) return
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incident-report-${d.date || todayIso}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMsg('c.downloaded')
  }

  const downloadJson = () => {
    const payload = {
      meta: {
        application: 'CyberShield Ethiopia',
        module: 'M3 Incident Response & Reporting Assistant',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
      },
      incident: {
        ...d,
        category: activeCategory,
        severity: categoryMetadata.severity,
        timeline: sortTimelineEvents(d.timeline || []),
        qaStatus: qaReview.status,
        userApproved,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incident-dossier-${d.date || todayIso}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadPdf = () => {
    if (!draft || isGenerating) return
    setIsGenerating(true)
    try {
      const pdfBlob = generateReportPdfBlob(draft, {
        title: `Cyber Incident Report: ${(d.type || activeCategory).toUpperCase()}`,
        date: d.date || todayIso,
      })
      if (!pdfBlob) {
        setMsg('c.pdf_download_err')
        setIsGenerating(false)
        return
      }
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incident-report-${d.date || todayIso}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg('c.pdf_generated')
    } catch (err) {
      setMsg('c.pdf_download_err')
    } finally {
      setIsGenerating(false)
    }
  }

  const openPdf = () => {
    if (!draft || isGenerating) return
    setIsGenerating(true)
    try {
      const pdfBlob = generateReportPdfBlob(draft, {
        title: `Cyber Incident Report: ${(d.type || activeCategory).toUpperCase()}`,
        date: d.date || todayIso,
      })
      if (!pdfBlob) {
        setMsg('c.pdf_download_err')
        setIsGenerating(false)
        return
      }
      const url = URL.createObjectURL(pdfBlob)
      const w = window.open(url, '_blank')
      if (!w) {
        setMsg('c.pdf_blocked_fallback')
      } else {
        setMsg('c.pdf_opened')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setMsg('c.pdf_download_err')
    } finally {
      setIsGenerating(false)
    }
  }

  const printPdf = () => {
    openPdf()
  }

  return (
    <section className="module-container" aria-labelledby="m3-main-heading">
      {/* Module Title & Hero */}
      <div className="module-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <img
            src="/images/journey/m3_incident_dossier.svg"
            alt={t('m3.artwork_alt')}
            style={{ width: '64px', height: '64px', borderRadius: '8px' }}
          />
          <div>
            <h1 id="m3-main-heading" style={{ margin: 0, fontSize: '1.6rem' }}>
              {t('m3.title')}
            </h1>
            <p className="lead" style={{ margin: '0.25rem 0 0', opacity: 0.85 }}>
              {t('m3.desc') || t('home.m3')}
            </p>
          </div>
        </div>
        <div className="module-assistant-shortcut">
          <button
            type="button"
            className="btn btn-sm btn-assistant-help"
            onClick={() => (onNavigate ? onNavigate('#/assistant?context=m3') : (window.location.hash = '#/assistant?context=m3'))}
            title={t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
          >
            🤖 {t('assistant.ask_ai_btn') || 'Ask CyberShield AI'}
          </button>
        </div>
      </div>

      {/* 4-Tab Navigation */}
      <div className="tab-navigation-bar" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'triage' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('triage')}
          style={{ whiteSpace: 'nowrap' }}
        >
          🛡️ {t('m3.tab.triage') || 'AI Incident Triage & Recovery'}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'details' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('details')}
          style={{ whiteSpace: 'nowrap' }}
        >
          📝 {t('m3.tab.details') || 'Incident Details & Evidence'}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'report' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('report')}
          style={{ whiteSpace: 'nowrap' }}
        >
          📄 {t('m3.tab.report') || 'Institutional Report & Review'}
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'directory' ? 'primary' : 'ghost'}`}
          onClick={() => setActiveTab('directory')}
          style={{ whiteSpace: 'nowrap' }}
        >
          🏛️ {t('m3.tab.directory') || 'Official Reporting Directory'}
        </button>
      </div>

      {msg && (
        <div className="alert info" role="status" style={{ marginBottom: '1rem' }}>
          {t(msg) || msg}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: AI INCIDENT TRIAGE & RECOVERY                                */}
      {/* ==================================================================== */}
      <div className="m3-triage-view" style={{ display: activeTab === 'triage' ? 'block' : 'none' }}>
        {/* Intelligent Incident-Based Reporting & Recovery Guide Card */}
        <div className="card m3-routing-guide-card">
          <h2 style={{ fontSize: '1.3rem', marginTop: 0, color: '#00C2D7', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛡️ {t('m3.routing.guide_title')}
          </h2>
          <p style={{ margin: '0.25rem 0 1.25rem', opacity: 0.9, fontSize: '0.95rem', lineHeight: '1.5', color: '#CBD5E1' }}>
            {t('m3.routing.guide_desc')}
          </p>

          {/* 4-Step Guided Workflow Banner */}
          <div className="routing-workflow-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#00C2D7', color: '#0B1220', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0 }}>1</span>
              <span><strong>1. Select Incident</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#00C2D7', color: '#0B1220', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0 }}>2</span>
              <span><strong>2. Official Authority</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#00C2D7', color: '#0B1220', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0 }}>3</span>
              <span><strong>3. Why & Evidence</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#00C2D7', color: '#0B1220', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', flexShrink: 0 }}>4</span>
              <span><strong>4. Open Portal ↗</strong></span>
            </div>
          </div>

          {/* Incident Archetype Selector Dropdown */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="m3-routing-incident-select" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem', color: '#F8FAFC' }}>
              {t('m3.routing.select_incident_label')}
            </label>
            <select
              id="m3-routing-incident-select"
              className="form-control"
              value={selectedRoutingIncident}
              onChange={(e) => setSelectedRoutingIncident(e.target.value)}
              style={{ width: '100%', maxWidth: '650px', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 500, background: '#0B1220', color: '#F8FAFC', border: '1px solid rgba(0, 194, 215, 0.4)' }}
            >
              {INCIDENT_ROUTING_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {t(p.categoryKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Destination Recommendation Card */}
          <div className="card routing-recommendation-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', flexShrink: 0 }}>
                  <img src={routingRec.primary.logo} alt={routingRec.primary.logoAlt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <span className="badge" style={{ padding: '3px 8px', borderRadius: '4px', background: '#00C2D7', color: '#0B1220', fontWeight: 'bold', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t(routingRec.primary.badgeKey)}
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', color: '#F8FAFC' }}>
                    {routingRec.primary.name}
                  </h3>
                </div>
              </div>
              {routingRec.primary.hotline && (
                <div style={{ background: '#0B1220', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0, 194, 215, 0.35)', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block' }}>{t(routingRec.primary.hotlineLabelKey || 'm3.directory.hotline_label')}</span>
                  <a href={`tel:${routingRec.primary.hotline}`} style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00C2D7', textDecoration: 'none' }}>
                    📞 {routingRec.primary.hotline}
                  </a>
                  {routingRec.primary.ussdCode && (
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#A5F3FC', marginTop: '2px' }}>
                      USSD: {routingRec.primary.ussdCode}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Why this destination */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#00C2D7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎯 {t('m3.routing.why_heading')}
              </h4>
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: '1.55', color: '#F8FAFC', opacity: 0.95 }}>
                {t(routingRec.primary.whyKey)}
              </p>
            </div>

            {/* What to prepare */}
            <div className="m3-prepare-box">
              <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📋 {t('m3.routing.prepare_heading')}
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.5', color: '#E2E8F0' }}>
                {t(routingRec.primary.prepareKey)}
              </p>
            </div>

            {/* What NEVER to share */}
            <div className="m3-never-share-box">
              <h4 style={{ margin: '0 0 4px', fontSize: '0.9rem', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🚫 {t('m3.routing.never_share_heading')}
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.5', color: '#FECACA' }}>
                {t(routingRec.primary.neverShareKey)}
              </p>
            </div>

            {/* Direct Action Link */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <a
                href={routingRec.primary.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn primary"
                style={{ padding: '0.65rem 1.4rem', fontSize: '0.95rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {t(routingRec.primary.actionLabelKey)}
              </a>
              {routingRec.primary.secondaryUrl && (
                <a
                  href={routingRec.primary.secondaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost small"
                  style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
                >
                  Alternate Portal ↗
                </a>
              )}
            </div>
          </div>

          {/* Secondary Destination Recommendation Card (if present) */}
          {routingRec.secondary && (
            <div className="card secondary-routing-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', flexShrink: 0 }}>
                    <img src={routingRec.secondary.logo} alt={routingRec.secondary.logoAlt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div>
                    <span className="badge" style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.2)', color: '#CBD5E1', fontSize: '0.7rem' }}>
                      {t(routingRec.secondary.badgeKey)}
                    </span>
                    <h4 style={{ margin: '3px 0 0', fontSize: '1.02rem', color: '#F8FAFC' }}>{routingRec.secondary.name}</h4>
                  </div>
                </div>
                {routingRec.secondary.hotline && (
                  <div style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>
                    <span>Hotline: </span>
                    <a href={`tel:${routingRec.secondary.hotline}`} style={{ color: '#00C2D7', fontWeight: 600 }}>{routingRec.secondary.hotline}</a>
                    {routingRec.secondary.secondaryPhone && (
                      <span style={{ marginLeft: '8px', opacity: 0.8 }}>| {routingRec.secondary.secondaryPhone}</span>
                    )}
                  </div>
                )}
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#E2E8F0' }}>
                <strong>Why: </strong>{t(routingRec.secondary.whyKey)}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.75rem' }}>
                <a
                  href={routingRec.secondary.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost small"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                >
                  {t(routingRec.secondary.actionLabelKey)}
                </a>
              </div>
            </div>
          )}

          {/* Clarification Guidance (if other_unclear) */}
          {routingRec.clarificationNeeded && (
            <div className="m3-clarification-box">
              <h4 style={{ margin: '0 0 6px', color: '#FBBF24', fontSize: '0.95rem' }}>
                💡 Need Help Narrowing Down Your Incident?
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.5', color: '#FEF3C7' }}>
                If you lost money from a bank or mobile wallet, choose <strong>Bank or Payment Fraud</strong> or <strong>Telebirr Fraud</strong>. If an online account was stolen, choose <strong>Facebook</strong>, <strong>Instagram</strong>, or <strong>Microsoft</strong>. For urgent national cyber triage, contact <strong>Ethio-CERT on 951</strong>.
              </p>
            </div>
          )}

          {/* Offline Incident Dossier Drafting Callout */}
          <div className="m3-offline-dossier-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: '1 1 320px' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', color: '#00C2D7' }}>
                📝 Need an Official Dossier for Evidence or Police?
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#CBD5E1', lineHeight: '1.4' }}>
                ABBAY CYBERGUARD drafts a standardized 14-section incident report completely offline in browser memory. No data is automatically submitted to any external server.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="btn primary"
                onClick={() => setActiveTab('details')}
                style={{ padding: '0.55rem 1.25rem', whiteSpace: 'nowrap' }}
              >
                Draft Offline Incident Dossier →
              </button>
            </div>
          </div>
        </div>

        {/* Natural Language Incident Input & ML Classification Card */}
        <div className="card m3-solid-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginTop: 0, color: '#00C2D7' }}>
              🧠 {t('m3.triage.identify_btn') || 'Describe Your Incident'}
            </h3>
            <label htmlFor="m3-natural-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#F8FAFC' }}>
              {t('m3.triage.input_label')}
            </label>
            <textarea
              id="m3-natural-input"
              rows={4}
              className="form-control"
              style={{ width: '100%', marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '6px', background: '#0B1220', color: '#F8FAFC', border: '1px solid rgba(0, 194, 215, 0.4)' }}
              placeholder={t('m3.triage.input_placeholder')}
              value={d.what}
              onChange={setField('what')}
            />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn primary"
                onClick={handleAnalyzeIncident}
              >
                🔍 {t('m3.triage.identify_btn')}
              </button>
              {mlSuggestion && (
                <span className="badge" style={{ padding: '6px 12px', background: '#0B1220', border: '1px solid rgba(0, 194, 215, 0.35)', color: '#00C2D7' }}>
                  ML Model: <strong>{mlSuggestion.predictedClass}</strong> ({(mlSuggestion.confidence * 100).toFixed(0)}%)
                </span>
              )}
            </div>

            {/* Identified Category Banner */}
            <div className="m3-category-banner" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ color: '#F8FAFC' }}>
                  <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>{categoryMetadata.icon}</span>
                  <strong>{t('m3.triage.detected_category')}</strong> {t(categoryMetadata.titleKey) || categoryMetadata.titleKey}
                </div>
                <div>
                  <span className="badge" style={{ padding: '4px 10px', background: categoryMetadata.severity === 'urgent' ? '#B91C1C' : categoryMetadata.severity === 'critical' ? '#EA580C' : '#0F766E', color: '#fff', fontWeight: 700 }}>
                    {t(`m3.triage.severity.${categoryMetadata.severity}`) || categoryMetadata.severity.toUpperCase()}
                  </span>
                </div>
              </div>
              <p style={{ margin: '0.5rem 0 0', color: '#CBD5E1', fontSize: '0.95rem' }}>
                {t(categoryMetadata.descKey)}
              </p>
            </div>
          </div>

          {/* Emergency Immediate Containment Checklist */}
          <div className="card m3-emergency-card">
            <h3 style={{ marginTop: 0, color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚨 {t('m3.triage.emergency_title')}
            </h3>
            <p style={{ margin: '0.25rem 0 1rem', color: '#CBD5E1' }}>
              {t('m3.triage.emergency_desc')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {emergencyActions.map((act) => (
                <div key={act.id} className="m3-emergency-item">
                  <span>{act.urgent ? '🔴' : '🟡'}</span>
                  <span style={{ fontWeight: act.urgent ? 600 : 400 }}>{t(act.actionKey)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Recovery Assistant */}
          <div className="card m3-recovery-guide-wrapper">
            <h3 style={{ marginTop: 0, color: '#00C2D7' }}>
              🔑 {t('m3.triage.platform_recovery_title')}
            </h3>
            <p style={{ margin: '0.25rem 0 1rem', color: '#CBD5E1' }}>
              {t('m3.triage.platform_recovery_desc')}
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="m3-platform-select" style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#F8FAFC' }}>
                {t('m3.triage.select_platform')}
              </label>
              <select
                id="m3-platform-select"
                className="form-control"
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', maxWidth: '350px', background: '#0B1220', color: '#F8FAFC', border: '1px solid rgba(0, 194, 215, 0.4)' }}
              >
                <option value="facebook">Facebook / Meta</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="google_gmail">Google / Gmail</option>
                <option value="microsoft">Microsoft / Outlook</option>
                <option value="telebirr">Ethio Telecom / Telebirr</option>
                <option value="cbe">Commercial Bank of Ethiopia (CBE)</option>
              </select>
            </div>

            {/* Platform Recovery Card */}
            <div className="m3-recovery-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{recoveryGuide.icon}</span>
                <h4 style={{ margin: 0, color: '#F8FAFC' }}>{recoveryGuide.name} Recovery Protocol</h4>
              </div>

              <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '0.95rem', marginBottom: '1rem', color: '#E2E8F0' }}>
                {t(recoveryGuide.recoveryStepsKey)}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {recoveryGuide.recoveryUrl && (
                  <a
                    href={recoveryGuide.recoveryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary"
                    style={{ textDecoration: 'none' }}
                  >
                    🔗 {t('m3.action.open_official_portal') || 'Open Official Recovery Portal'}
                  </a>
                )}
                {recoveryGuide.hotline && (
                  <span className="badge" style={{ padding: '6px 12px', background: '#0F766E', color: '#fff', fontWeight: 600 }}>
                    📞 Hotline: {recoveryGuide.hotline}
                  </span>
                )}
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#261C08', borderLeft: '4px solid #D97706', borderRadius: '4px', fontSize: '0.85rem', color: '#FEF3C7' }}>
                ⚠️ <strong>Security Notice:</strong> {t(recoveryGuide.warningKey)}
              </div>
            </div>
          </div>

          {/* Secondary Recovery Scam Protection */}
          <div className="card m3-scam-alert-card">
            <h4 style={{ margin: '0 0 0.5rem', color: '#FCA5A5' }}>
              🛡️ {t('m3.triage.scam_alert_title')}
            </h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#FECACA' }}>
              {t('m3.triage.scam_alert_desc')}
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#FECACA' }}>
              {RECOVERY_SCAM_FLAGS.map((flagKey) => (
                <li key={flagKey} style={{ marginBottom: '4px' }}>{t(flagKey)}</li>
              ))}
            </ul>
          </div>

          {/* Continue Action */}
          <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => setActiveTab('details')}
              style={{ padding: '0.6rem 1.5rem', fontSize: '1rem' }}
            >
              Next: Incident Details & Evidence →
            </button>
          </div>
        </div>

      {/* ==================================================================== */}
      {/* TAB 2: INCIDENT DETAILS & EVIDENCE ORGANIZER                         */}
      {/* ==================================================================== */}
      <div className="m3-details-view" style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
          <h2>{t('m3.step1')}</h2>
          <form onSubmit={handleMakeDraft} noValidate>
            {/* Required Form Inputs with Accessible Selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label htmlFor="m3-type" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.type')} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="m3-type"
                  aria-required="true"
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                  value={d.type}
                  onChange={setField('type')}
                >
                  <option value="">{t('m3.choose')}</option>
                  {TYPES.filter(Boolean).map((ty) => (
                    <option key={ty} value={ty}>{t(`m3.type.${ty}`) || ty}</option>
                  ))}
                </select>
                {errs.type && <span className="error-text" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{t(errs.type)}</span>}
              </div>

              <div>
                <label htmlFor="m3-date" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.date')} <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="m3-date"
                  type="date"
                  aria-required="true"
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                  value={d.date}
                  onChange={setField('date')}
                  max={todayIso}
                />
                {errs.date && <span className="error-text" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{t(errs.date)}</span>}
              </div>
            </div>

            {/* Description Text Area */}
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="m3-what" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                {t('m3.f.what')} <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="m3-what"
                rows={5}
                aria-required="true"
                maxLength={3000}
                className="form-control"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px' }}
                value={d.what}
                onChange={setField('what')}
                placeholder={t('m3.triage.input_placeholder')}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.75 }}>
                <span>{d.what.length} / 3000</span>
                {errs.what && <span style={{ color: '#dc2626' }}>{t(errs.what)}</span>}
              </div>
            </div>

            {/* Method, Suspect, Loss Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label htmlFor="m3-method" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.method')}
                </label>
                <select id="m3-method" className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }} value={d.method} onChange={setField('method')}>
                  <option value="">{t('m3.choose')}</option>
                  {METHODS.filter(Boolean).map((m) => (
                    <option key={m} value={m}>{t(`m3.method.${m}`) || t(`m3.meth.${m}`) || m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="m3-loss" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.loss')}
                </label>
                <select id="m3-loss" className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }} value={d.loss} onChange={setField('loss')}>
                  <option value="">{t('m3.choose')}</option>
                  {LOSSES.filter(Boolean).map((l) => (
                    <option key={l} value={l}>{t(`m3.loss.${l}`) || l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="m3-amount" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.amount')} (ETB)
                </label>
                <input
                  id="m3-amount"
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                  value={d.amount}
                  onChange={setField('amount')}
                  placeholder="e.g. 5000"
                />
              </div>
            </div>

            {/* Suspect & Reporter */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label htmlFor="m3-suspect" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.suspect')}
                </label>
                <input
                  id="m3-suspect"
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                  value={d.suspect}
                  onChange={setField('suspect')}
                  placeholder="Phone number, username, or URL"
                />
              </div>

              <div>
                <label htmlFor="m3-reporter" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('m3.f.reporter')}
                </label>
                <input
                  id="m3-reporter"
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                  value={d.reporter}
                  onChange={setField('reporter')}
                  placeholder="Optional contact (phone or email)"
                />
                {errs.reporter && <span style={{ color: '#dc2626', fontSize: '0.85rem' }}>{t(errs.reporter)}</span>}
              </div>
            </div>

            {/* Chronological Event Timeline Section */}
            <div className="timeline-section" style={{ margin: '20px 0', padding: '16px', background: 'var(--card-bg, #1a2234)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div className="timeline-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📅 {t('m3.timeline.title')}</h3>
                  <p className="small field-hint" style={{ margin: '4px 0 0 0', opacity: 0.8 }}>{t('m3.timeline.desc_hint')}</p>
                </div>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={handleAddTimelineEvent}
                  aria-label={t('m3.timeline.add')}
                  style={{ padding: '6px 12px' }}
                >
                  + {t('m3.timeline.add')}
                </button>
              </div>

              {(d.timeline || []).length > 0 && (
                <div className="timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(d.timeline || []).map((ev, index) => (
                    <div key={ev.id || index} className="timeline-item-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="date"
                        value={ev.date || ''}
                        max={todayIso}
                        onChange={(e) => handleUpdateTimelineEvent(ev.id, 'date', e.target.value)}
                        className="form-control timeline-date"
                        style={{ maxWidth: '140px', padding: '4px 8px' }}
                        aria-label={`${t('m3.timeline.date')} ${index + 1}`}
                      />
                      <input
                        type="time"
                        value={ev.time || ''}
                        onChange={(e) => handleUpdateTimelineEvent(ev.id, 'time', e.target.value)}
                        className="form-control timeline-time"
                        style={{ maxWidth: '110px', padding: '4px 8px' }}
                        aria-label={`${t('m3.timeline.time')} ${index + 1}`}
                      />
                      <input
                        type="text"
                        value={ev.description || ''}
                        onChange={(e) => handleUpdateTimelineEvent(ev.id, 'description', e.target.value)}
                        placeholder={t('m3.timeline.desc')}
                        className="form-control timeline-desc"
                        style={{ flex: 1, minWidth: '180px', padding: '4px 8px' }}
                        aria-label={`${t('m3.timeline.desc')} ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="btn ghost small timeline-remove"
                        onClick={() => handleRemoveTimelineEvent(ev.id)}
                        aria-label={`${t('m3.timeline.remove')} ${index + 1}`}
                        style={{ padding: '4px 8px', color: '#ff3366' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evidence & Artifact Organizer Section */}
            <div className="evidence-section" style={{ margin: '20px 0', padding: '16px', background: 'var(--card-bg, #1a2234)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>📎 {t('m3.evidence.title') || 'Evidence & Artifact Organizer'}</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', opacity: 0.8 }}>
                {t('m3.evidence.desc_hint') || 'Catalog screenshots, links, and transaction numbers locally in browser memory.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                <select
                  value={newEvidence.type}
                  onChange={(e) => setNewEvidence((prev) => ({ ...prev, type: e.target.value }))}
                  className="form-control"
                  style={{ padding: '6px' }}
                >
                  <option value="screenshot">{t('m3.evidence.type_screenshot') || 'Screenshot'}</option>
                  <option value="sms">{t('m3.evidence.type_sms') || 'SMS Message'}</option>
                  <option value="email">{t('m3.evidence.type_email') || 'Email Header'}</option>
                  <option value="url">{t('m3.evidence.type_url') || 'Deceptive URL'}</option>
                  <option value="transaction">{t('m3.evidence.type_transaction') || 'Transaction Ref'}</option>
                  <option value="log">{t('m3.evidence.type_log') || 'System Log'}</option>
                </select>

                <input
                  type="text"
                  placeholder={t('m3.evidence.desc_label') || 'Evidence description'}
                  value={newEvidence.description}
                  onChange={(e) => setNewEvidence((prev) => ({ ...prev, description: e.target.value }))}
                  className="form-control"
                  style={{ padding: '6px' }}
                />

                <input
                  type="text"
                  placeholder={t('m3.evidence.source_label') || 'Source / device'}
                  value={newEvidence.source}
                  onChange={(e) => setNewEvidence((prev) => ({ ...prev, source: e.target.value }))}
                  className="form-control"
                  style={{ padding: '6px' }}
                />

                <button
                  type="button"
                  className="btn ghost small"
                  onClick={handleAddEvidenceItem}
                  style={{ padding: '6px 12px' }}
                >
                  + {t('m3.evidence.add_btn') || 'Add Evidence'}
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#ffb800', marginBottom: '10px' }}>
                ⚠️ {t('m3.evidence.redaction_warning')}
              </div>

              {(d.evidenceItems || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(d.evidenceItems || []).map((ev) => (
                    <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        <strong>[{ev.type.toUpperCase()}]:</strong> {ev.description} <em>({ev.source})</em>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidenceItem(ev.id)}
                        className="btn ghost small"
                        style={{ color: '#ff3366', padding: '2px 6px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setActiveTab('triage')}
              >
                ← Back to Triage
              </button>
              <button
                type="submit"
                className="btn primary"
                style={{ padding: '0.6rem 1.5rem', fontSize: '1rem' }}
              >
                Generate Institutional Report Draft →
              </button>
            </div>
          </form>
        </div>

      {/* ==================================================================== */}
      {/* TAB 3: INSTITUTIONAL REPORT & REVIEW                                 */}
      {/* ==================================================================== */}
      <div className="m3-report-view" style={{ display: activeTab === 'report' ? 'block' : 'none' }}>
          <h2>{t('m3.step2')}</h2>

          {/* Institutional Recipient Profile Selector */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
            <label htmlFor="m3-profile-select" style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              {t('m3.inst.select_recipient_label')}
            </label>
            <select
              id="m3-profile-select"
              className="form-control"
              value={selectedProfileId}
              onChange={(e) => {
                setSelectedProfileId(e.target.value)
                handleMakeDraft()
              }}
              style={{ width: '100%', maxWidth: '450px', padding: '0.5rem', borderRadius: '6px' }}
            >
              {INSTITUTIONAL_PROFILES.map((prof) => (
                <option key={prof.id} value={prof.id}>{t(prof.nameKey) || prof.defaultRecipient}</option>
              ))}
            </select>
          </div>

          {/* Multilingual Text Polish & Side-by-Side Diff */}
          {d.what && (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem' }}>
                ✍️ {t('m3.lang.changes_title') || 'Natural Language Polish & Meaning Preservation'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
                    {t('m3.lang.original_label')}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{polishedTextResult.original}</p>
                </div>

                <div style={{ padding: '0.75rem', background: 'rgba(0, 255, 204, 0.05)', borderRadius: '6px', border: '1px solid rgba(0, 255, 204, 0.3)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#00ffcc', display: 'block', marginBottom: '4px' }}>
                    {t('m3.lang.corrected_label')}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{polishedTextResult.corrected}</p>
                </div>
              </div>

              {polishedTextResult.changes.length > 0 && (
                <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <strong>Refinements Made:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem' }}>
                    {polishedTextResult.changes.map((ch, idx) => (
                      <li key={idx}>{t(ch.descKey) || ch.descKey}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${textPolishedAccepted ? 'primary' : 'ghost'} small`}
                  onClick={() => {
                    setTextPolishedAccepted(true)
                    handleMakeDraft()
                  }}
                >
                  ✓ {t('m3.lang.accept_btn')}
                </button>
                <button
                  type="button"
                  className={`btn ${!textPolishedAccepted ? 'primary' : 'ghost'} small`}
                  onClick={() => {
                    setTextPolishedAccepted(false)
                    handleMakeDraft()
                  }}
                >
                  ✕ {t('m3.lang.reject_btn')}
                </button>
              </div>
            </div>
          )}

          {/* AI Quality Assurance Review Panel */}
          <div className="card m3-qa-review-card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderLeft: `4px solid ${qaReview.status === 'ready_for_review' ? '#00ffcc' : qaReview.status === 'privacy_warning' ? '#ff3366' : '#ffb800'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                🔍 {t('m3.qa.title')}
              </h3>
              <span className="badge" style={{ padding: '4px 10px', background: qaReview.status === 'ready_for_review' ? '#059669' : qaReview.status === 'privacy_warning' ? '#dc2626' : '#d97706', color: '#fff' }}>
                {t(`m3.qa.status.${qaReview.status === 'ready_for_review' ? 'ready' : qaReview.status === 'privacy_warning' ? 'privacy' : 'suggested'}`)}
              </span>
            </div>

            {qaReview.issues.length > 0 && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                {qaReview.issues.map((iss, idx) => (
                  <div key={idx} style={{ color: iss.severity === 'critical' ? '#f87171' : '#fbbf24', marginTop: '4px' }}>
                    • {t(iss.key) || iss.msg}
                  </div>
                ))}
              </div>
            )}
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', opacity: 0.65 }}>
              {t('m3.qa.disclaimer_unofficial')}
            </p>
          </div>

          {/* Document Preview & Draft Editor */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
              <label htmlFor="m3-draft" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                {t('m3.step2')} (14-Section Standardized Dossier)
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>{t('m3.lang.translate_to') || 'Translate to:'}</span>
                <select
                  value={reportLang}
                  onChange={(e) => {
                    const nextLang = e.target.value
                    setReportLang(nextLang)
                    if (draft) {
                      setDraft(translateInstitutionalContent(draft, reportLang, nextLang))
                    }
                  }}
                  className="form-control small"
                  style={{ padding: '3px 8px', borderRadius: '4px' }}
                >
                  <option value="en">English</option>
                  <option value="om">Afaan Oromoo</option>
                  <option value="am">አማርኛ (Amharic)</option>
                </select>
              </div>
            </div>

            <textarea
              id="m3-draft"
              rows={18}
              className="form-control"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4', padding: '0.75rem', borderRadius: '6px' }}
              value={draft || ''}
              onChange={(e) => {
                setDraft(e.target.value)
                setUserApproved(false)
              }}
            />

            {/* User Approval */}
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${userApproved ? 'primary' : 'ghost'}`}
                onClick={() => setUserApproved(!userApproved)}
              >
                {userApproved ? '✓ ' + (t('m3.action.approved_badge') || 'Approved by User') : '✍️ ' + (t('m3.action.approve_report') || 'Formally Approve Final Report Draft')}
              </button>
            </div>
          </div>

          {/* Export Action Controls */}
          <div className="m3-export-panel" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <button className="btn ghost" type="button" onClick={copyReportText} aria-label={t('m3.action.copy_report')}>
              📋 {t('m3.action.copy_report') || 'Copy Report'}
            </button>
            <button className="btn ghost" type="button" onClick={downloadText} aria-label={t('c.download')}>
              💾 {t('m3.action.export_txt') || 'Download TXT'}
            </button>
            <button className="btn primary-action" type="button" onClick={downloadPdf} aria-label={t('c.download_pdf')}>
              📄 {t('m3.action.export_pdf') || 'Download PDF'}
            </button>
            <button className="btn ghost" type="button" onClick={downloadJson} aria-label="Export JSON">
              🗂️ {t('m3.action.export_json') || 'Export JSON'}
            </button>
            <button className="btn ghost" type="button" onClick={openPdf} aria-label={t('c.open_pdf')}>
              👁️ {t('c.open_pdf')}
            </button>
            <button className="btn ghost" type="button" onClick={printPdf} aria-label={t('c.print_pdf')}>
              🖨️ {t('c.print_pdf')}
            </button>
          </div>
        </div>

      {/* ==================================================================== */}
      {/* TAB 4: OFFICIAL REPORTING DIRECTORY                                  */}
      {/* ==================================================================== */}
      <div className="m3-directory-view" style={{ display: activeTab === 'directory' ? 'block' : 'none' }}>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>
              🏛️ {t('m3.directory.title')}
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', opacity: 0.85 }}>
              {t('m3.directory.desc')}
            </p>

            {/* Directory Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <input
                id="m3-dir-search"
                type="text"
                placeholder="Search by authority name, hotline, or service..."
                className="form-control"
                style={{ padding: '6px 10px' }}
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
              />

              <select
                className="form-control"
                style={{ padding: '6px' }}
                value={dirScope}
                onChange={(e) => setDirScope(e.target.value)}
              >
                <option value="all">{t('m3.directory.scope_all') || 'All Jurisdictions'}</option>
                <option value="ethiopia_national">{t('m3.directory.scope_ethiopia') || 'Ethiopian Authorities'}</option>
                <option value="global_platform">{t('m3.directory.scope_global') || 'Global Platforms'}</option>
              </select>

              <select
                className="form-control"
                style={{ padding: '6px' }}
                value={dirCategory}
                onChange={(e) => setDirCategory(e.target.value)}
              >
                <option value="all">{t('m3.directory.filter_all') || 'All Categories'}</option>
                {INCIDENT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{t(cat.titleKey) || cat.id}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Resource Cards Grid */}
          {filteredDirectory.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', margin: '1rem 0', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }} aria-hidden="true">🔍</div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{t('m3.directory.no_results')}</h4>
              <button
                type="button"
                className="btn ghost small"
                style={{ marginTop: '0.5rem', padding: '0.4rem 1rem' }}
                onClick={() => {
                  setDirSearch('')
                  setDirCategory('all')
                  setDirScope('all')
                }}
              >
                {t('m3.directory.reset_filter')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {filteredDirectory.map((org) => (
                <div key={org.id} className="card m3-dir-card" style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      {org.logo && (
                        <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', flexShrink: 0, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                          <img src={org.logo} alt={org.logoAlt || org.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.98rem', lineHeight: 1.3, color: '#F8FAFC' }}>{org.name}</h4>
                          <span className="badge" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 194, 215, 0.15)', color: '#00C2D7', border: '1px solid rgba(0, 194, 215, 0.35)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {t(org.badgeKey) || t('m3.directory.verified_badge')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                      {org.phoneHotline && (
                        <div style={{ margin: '3px 0' }}>
                          <strong style={{ color: '#CBD5E1' }}>{t('m3.directory.hotline_label')}</strong>{' '}
                          <a href={`tel:${org.phoneHotline}`} style={{ color: '#00C2D7', fontWeight: 700 }}>{org.phoneHotline}</a>
                        </div>
                      )}
                      {org.secondaryPhone && (
                        <div style={{ margin: '2px 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                          <span>Direct: </span>
                          <a href={`tel:${org.secondaryPhone.replace(/\s+/g, '')}`} style={{ color: '#00C2D7' }}>{org.secondaryPhone}</a>
                        </div>
                      )}
                      {org.officeLocation && (
                        <div style={{ margin: '3px 0', color: '#94A3B8' }}>
                          📍 {org.officeLocation}
                        </div>
                      )}
                    </div>

                    {org.notesKey && (
                      <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#CBD5E1' }}>
                        {t(org.notesKey)}
                      </p>
                    )}

                    {org.verifiedLimitationsKey && (
                      <div style={{ fontSize: '0.75rem', color: '#FEF3C7', background: '#261C08', border: '1px solid #D97706', padding: '6px 10px', borderRadius: '4px', marginBottom: '8px' }}>
                        <strong>{t('m3.directory.limitations_label')}</strong> {t(org.verifiedLimitationsKey)}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Audited: {org.lastVerified}</span>
                    <a
                      href={org.reportingUrl || org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn ghost small"
                      style={{ textDecoration: 'none', padding: '3px 8px', fontSize: '0.8rem' }}
                    >
                      Open Portal ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* ==================================================================== */}
      {/* PRESERVED SAFETY GUIDANCE & CHANNELS CARDS (SSR Invariants)          */}
      {/* ==================================================================== */}
      <div className="card" style={{ padding: '1rem', marginTop: '1.5rem', background: 'var(--card-bg)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>🛡️ {t('m3.safety_title')}</h3>
        <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem', opacity: 0.85 }}>
          <li>{t('m3.safety.evidence')}</li>
          <li>{t('m3.safety.credentials')}</li>
          <li>{t('m3.safety.action')}</li>
        </ul>
      </div>

      <div className="card" style={{ padding: '1rem', marginTop: '1rem', background: 'var(--card-bg)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{t('m3.ch')}</h3>
        {channels.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>{t('m3.chnone')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {channels.map((c, i) => (
              <div key={i}>{c.name}: {c.contact}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
