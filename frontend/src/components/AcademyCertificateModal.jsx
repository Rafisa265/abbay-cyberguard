import { useState, useRef } from 'react'

/**
 * Generates a cryptographically random certificate ID in the format ACYBER-YYYY-XXXXXXXXXXXXXXXX.
 * Uses crypto.getRandomValues for unpredictability. Only called when no persisted ID exists.
 */
function generateCertId() {
  const year = new Date().getFullYear()
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)
  const hex = Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `ACYBER-${year}-${hex}`
}

/**
 * Generates a cryptographically random 128-bit verification code (32-char hex).
 * Local-only: not checked against any external service. Stored in earnedCertificates.
 */
function generateVerificationCode() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Returns honest completion text based on actual score and mastery criteria.
 * "mastered"   → score ≥ 80% AND 3 stars
 * "completed"  → passed (score ≥ 60%)
 * "participated" → attempted but did not pass
 */
function getCompletionVerb(certData) {
  const score = typeof certData.score === 'number' ? certData.score : null
  const stars = typeof certData.stars === 'number' ? certData.stars : 0
  if (score !== null && score >= 80 && stars >= 3) return 'has successfully mastered and demonstrated competence in'
  if (score !== null && score >= 60) return 'has successfully completed coursework in'
  if (score !== null) return 'has participated in and engaged with'
  // No score data — fallback to conservative wording
  return 'has successfully completed coursework in'
}

export default function AcademyCertificateModal({ certData, onClose, t }) {
  const [recipientName, setRecipientName] = useState(certData.recipientName || 'Guest Defender')
  const [isEditingName, setIsEditingName] = useState(false)
  const [isGeneratingPng, setIsGeneratingPng] = useState(false)
  const certificateRef = useRef(null)

  const issueDate = certData.issueDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Use persisted cryptographic ID if available; generate a new one only once per modal open.
  // The persisted ID is stored in academyProgress.earnedCertificates by Learn.jsx.
  const certId = certData.certificateId || generateCertId()

  // Verification code: random 32-char hex. NOT derived from name or level number.
  // Local-only: "verify" means checking this code matches the locally stored record.
  const verificationCode = certData.verificationCode || generateVerificationCode()

  const completionVerb = getCompletionVerb(certData)

  // Score display: show score if available
  const scoreDisplay =
    typeof certData.score === 'number'
      ? `${certData.score}%${certData.stars ? ` · ${'★'.repeat(certData.stars)}${'☆'.repeat(3 - certData.stars)}` : ''}`
      : null

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPng = () => {
    setIsGeneratingPng(true)
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 850
    const ctx = canvas.getContext('2d')

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 850)
    bgGrad.addColorStop(0, '#0B1220')
    bgGrad.addColorStop(0.5, '#14233B')
    bgGrad.addColorStop(1, '#070D18')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 1200, 850)

    // Gold/Cyan double outer border
    ctx.lineWidth = 6
    ctx.strokeStyle = '#00C2D7'
    ctx.strokeRect(30, 30, 1140, 790)

    ctx.lineWidth = 2
    ctx.strokeStyle = '#F59E0B'
    ctx.strokeRect(42, 42, 1116, 766)

    // Inner subtle pattern
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 194, 215, 0.15)'
    ctx.strokeRect(55, 55, 1090, 740)

    // Header Emblem & Brand
    ctx.textAlign = 'center'
    ctx.fillStyle = '#00C2D7'
    ctx.font = 'bold 34px "Segoe UI", sans-serif'
    ctx.fillText('🛡️ ABBAY CYBERGUARD', 600, 120)

    ctx.fillStyle = '#94A3B8'
    ctx.font = '600 16px "Segoe UI", sans-serif'
    ctx.fillText('LEARN. PROTECT. EMPOWER. | ETHIOPIAN DIGITAL SAFETY PLATFORM', 600, 155)

    // Title
    ctx.fillStyle = '#F59E0B'
    ctx.font = 'bold 24px "Segoe UI", sans-serif'
    ctx.fillText('CERTIFICATE OF EDUCATIONAL COMPLETION', 600, 230)

    ctx.fillStyle = '#CBD5E1'
    ctx.font = 'normal 18px "Segoe UI", sans-serif'
    ctx.fillText('This record certifies that', 600, 280)

    // Recipient Name
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 44px "Segoe UI", sans-serif'
    ctx.fillText(recipientName, 600, 350)

    // Decorative line under name
    ctx.strokeStyle = '#00C2D7'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(350, 375)
    ctx.lineTo(850, 375)
    ctx.stroke()

    // Achievement Description
    ctx.fillStyle = '#E2E8F0'
    ctx.font = 'normal 20px "Segoe UI", sans-serif'
    ctx.fillText(completionVerb, 600, 430)

    ctx.fillStyle = '#00C2D7'
    ctx.font = 'bold 28px "Segoe UI", sans-serif'
    ctx.fillText(certData.title || 'Cybersecurity Academy Level Defense Assessment', 600, 480)

    // Score line (if available)
    if (scoreDisplay) {
      ctx.fillStyle = '#F59E0B'
      ctx.font = 'bold 18px "Segoe UI", sans-serif'
      ctx.fillText(`Assessment Score: ${scoreDisplay}`, 600, 520)
    }

    // Completion Details Box
    ctx.fillStyle = '#94A3B8'
    ctx.font = 'normal 16px "Segoe UI", sans-serif'
    ctx.fillText(`Issued: ${issueDate}   |   Certificate ID: ${certId}`, 600, scoreDisplay ? 560 : 540)

    ctx.fillStyle = '#64748B'
    ctx.font = 'italic 13px "Segoe UI", sans-serif'
    ctx.fillText(`Local Verification Code: ${verificationCode}`, 600, scoreDisplay ? 585 : 565)

    // Honest Academic Disclaimer
    ctx.fillStyle = '#94A3B8'
    ctx.font = 'italic 13px "Segoe UI", sans-serif'
    ctx.fillText('Notice: This platform-issued completion record verifies simulated academic coursework completion.', 600, 720)
    ctx.fillText('It does not confer professional licensure, university degree credit, or official accreditation.', 600, 740)
    ctx.fillText('Verification is local only — this code confirms your locally stored progress record.', 600, 760)

    // Footer — honest label, no external verification implied
    ctx.fillStyle = '#00C2D7'
    ctx.font = 'bold 15px "Segoe UI", sans-serif'
    ctx.fillText('ABBAY CYBERGUARD ACADEMY ★ EDUCATIONAL COMPLETION RECORD', 600, 800)

    // Download trigger
    const link = document.createElement('a')
    link.download = `abbay-cyberguard-certificate-${certId.toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setIsGeneratingPng(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(7, 13, 24, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: '#14233B',
          border: '1px solid #1E293B',
          borderRadius: '14px',
          maxWidth: '900px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #1E293B', background: '#0B1220' }}>
          <h3 id="cert-modal-title" style={{ margin: 0, color: '#00C2D7', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📜</span> {t('academy.cert.modal_title') || 'Downloadable Completion Certificate'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost small"
            style={{ fontSize: '1.2rem', padding: '4px 8px', lineHeight: 1 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Certificate Preview */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Editable Name Bar */}
          <div style={{ marginBottom: '16px', padding: '10px 16px', background: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Certificate Recipient Name:</span>
              {isEditingName ? (
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  style={{ background: '#14233B', border: '1px solid #00C2D7', color: '#F8FAFC', padding: '4px 10px', borderRadius: '4px', fontSize: '0.9rem' }}
                />
              ) : (
                <strong style={{ color: '#F8FAFC', fontSize: '0.95rem' }}>{recipientName}</strong>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsEditingName(!isEditingName)}
              className="btn ghost small"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            >
              {isEditingName ? '✓ Done' : '✏️ Change Name'}
            </button>
          </div>

          {/* Certificate Surface */}
          <div
            ref={certificateRef}
            className="abbay-certificate-surface"
            style={{
              background: 'linear-gradient(135deg, #0B1220 0%, #14233B 50%, #070D18 100%)',
              border: '4px double #00C2D7',
              borderRadius: '12px',
              padding: '40px 32px',
              textAlign: 'center',
              boxShadow: 'inset 0 0 40px rgba(0, 194, 215, 0.08)',
              position: 'relative',
              color: '#F8FAFC',
            }}
          >
            {/* Header Emblem */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem' }}>🛡️</span>
              <h2 style={{ margin: '8px 0 2px', color: '#00C2D7', fontSize: '1.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                ABBAY CYBERGUARD
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#94A3B8', letterSpacing: '0.1em', fontWeight: 600 }}>
                LEARN. PROTECT. EMPOWER. | ETHIOPIAN DIGITAL SAFETY PLATFORM
              </span>
            </div>

            <div style={{ margin: '20px auto', maxWidth: '600px', height: '1px', background: 'linear-gradient(90deg, transparent, #F59E0B, transparent)' }} />

            <h4 style={{ color: '#F59E0B', fontSize: '1.15rem', letterSpacing: '0.08em', margin: '0 0 10px', textTransform: 'uppercase' }}>
              CERTIFICATE OF EDUCATIONAL COMPLETION
            </h4>
            <p style={{ margin: '0 0 16px', color: '#CBD5E1', fontSize: '0.95rem' }}>
              This record certifies that
            </p>

            <h1 style={{ margin: '0 0 12px', fontSize: '2.2rem', color: '#FFFFFF', fontWeight: 800 }}>
              {recipientName}
            </h1>
            <div style={{ width: '280px', height: '2px', background: '#00C2D7', margin: '0 auto 18px' }} />

            <p style={{ margin: '0 0 8px', color: '#CBD5E1', fontSize: '0.95rem' }}>
              {completionVerb}
            </p>
            <h3 style={{ margin: '0 0 16px', color: '#00C2D7', fontSize: '1.35rem' }}>
              {certData.title || 'Cybersecurity Academy Level Defense Assessment'}
            </h3>

            {/* Score display on certificate surface */}
            {scoreDisplay && (
              <div style={{ margin: '0 0 20px', padding: '8px 20px', display: 'inline-block', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px' }}>
                <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '1rem' }}>
                  Assessment Score: {scoreDisplay}
                </span>
              </div>
            )}

            {/* Metadata Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid #1E293B', paddingTop: '18px', marginTop: '24px', fontSize: '0.84rem', color: '#94A3B8' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Issue Date</span>
                <strong style={{ color: '#F8FAFC' }}>{issueDate}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Certificate Number</span>
                <strong style={{ color: '#00C2D7', fontFamily: 'monospace' }}>{certId}</strong>
              </div>
              <div title="Verification is local only — this code confirms your locally stored progress record.">
                <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Platform Seal</span>
                <strong style={{ color: '#10B981' }}>✓ LOCALLY RECORDED</strong>
              </div>
            </div>

            {/* Local verification code */}
            <div style={{ margin: '14px auto 0', maxWidth: '640px', padding: '8px 14px', background: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B', textAlign: 'left' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Local Verification Code
              </span>
              <code style={{ fontSize: '0.78rem', color: '#94A3B8', wordBreak: 'break-all', fontFamily: 'monospace' }}>{verificationCode}</code>
              <span style={{ fontSize: '0.68rem', color: '#475569', display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                Verification is local only — this code confirms your locally stored progress record. It is not registered with any external authority.
              </span>
            </div>

            {/* Honest Academic Disclaimer */}
            <p style={{ margin: '24px auto 0', maxWidth: '640px', fontSize: '0.75rem', color: '#64748B', lineHeight: 1.45, fontStyle: 'italic' }}>
              Notice: This platform-issued completion record verifies simulated academic coursework completion.
              It does not confer professional licensure, university degree credit, or official state accreditation.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', padding: '16px 24px', borderTop: '1px solid #1E293B', background: '#0B1220' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            style={{ fontSize: '0.88rem' }}
          >
            Close
          </button>
          <button
            type="button"
            className="btn outline"
            onClick={handlePrint}
            style={{ fontSize: '0.88rem' }}
          >
            🖨️ Print Certificate
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            style={{ fontSize: '0.88rem', fontWeight: 700 }}
          >
            📥 {isGeneratingPng ? 'Generating...' : 'Download Certificate Image (PNG)'}
          </button>
        </div>
      </div>
    </div>
  )
}
