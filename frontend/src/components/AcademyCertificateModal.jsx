import { useState } from 'react'
import { createPdfWithJpegPages } from '../lib/deviceSecurityReport.js'

export default function AcademyCertificateModal({
  certData,
  onClose,
  onIssue,
  t,
  language = 'en',
}) {
  const [recipientName, setRecipientName] = useState(certData.recipientName || '')
  const [certificate, setCertificate] = useState(certData.certificate || null)
  const [isIssuing, setIsIssuing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState('')

  const translate = (key, fallback) => t?.(key) || fallback
  const issueDate = certificate?.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString(language)
    : null
  const certificateId = certificate?.certificate_id
  const verificationUrl = certificateId && typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}#/verify?certificateId=${encodeURIComponent(certificateId)}`
    : ''

  const handleIssue = async () => {
    setError('')
    setIsIssuing(true)
    try {
      const result = await onIssue({
        levelNum: certData.levelNum,
        recipientName,
        language,
      })
      setCertificate(result)
    } catch (issueError) {
      const messages = {
        CERTIFICATE_REQUIREMENTS_INCOMPLETE: translate(
          'academy.cert.requirements_incomplete',
          'Pass the required server-verified assessments before issuing this certificate.',
        ),
        INVALID_REQUEST: translate(
          'academy.cert.full_name_required',
          'Enter your full name using at least two words.',
        ),
      }
      setError(messages[issueError?.code] || translate(
        'academy.cert.issue_failed',
        'The certificate could not be issued. Check your connection and try again.',
      ))
    } finally {
      setIsIssuing(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!certificate) return
    setIsDownloading(true)
    setError('')
    try {
      if (document.fonts?.ready) await document.fonts.ready
      const canvas = document.createElement('canvas')
      canvas.width = 1684
      canvas.height = 1190
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('CERTIFICATE_CANVAS_UNAVAILABLE')

      const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      background.addColorStop(0, '#0B1220')
      background.addColorStop(0.52, '#14233B')
      background.addColorStop(1, '#070D18')
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = '#00C2D7'
      ctx.lineWidth = 8
      ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70)
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = 3
      ctx.strokeRect(52, 52, canvas.width - 104, canvas.height - 104)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#00C2D7'
      ctx.font = '700 44px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText('ABBAY CYBERGUARD', canvas.width / 2, 170)
      ctx.fillStyle = '#94A3B8'
      ctx.font = '600 22px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText('LEARN. PROTECT. EMPOWER.', canvas.width / 2, 210)

      ctx.fillStyle = '#F59E0B'
      ctx.font = '700 34px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(
        translate('academy.cert.document_title', 'CERTIFICATE OF ASSESSMENT MILESTONE'),
        canvas.width / 2,
        320,
        canvas.width - 180,
      )
      ctx.fillStyle = '#CBD5E1'
      ctx.font = '26px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(translate('academy.cert.certifies', 'This record certifies that'), canvas.width / 2, 390)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '700 54px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(recipientName, canvas.width / 2, 490, canvas.width - 180)
      ctx.strokeStyle = '#00C2D7'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(420, 525)
      ctx.lineTo(canvas.width - 420, 525)
      ctx.stroke()
      ctx.fillStyle = '#CBD5E1'
      ctx.font = '26px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(
        translate('academy.cert.completed_coursework', 'has passed the server-verified assessment milestone for'),
        canvas.width / 2,
        595,
      )
      ctx.fillStyle = '#00C2D7'
      ctx.font = '700 34px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(certificate.course_title, canvas.width / 2, 660, canvas.width - 180)
      ctx.fillStyle = '#CBD5E1'
      ctx.font = '22px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(`${translate('academy.cert.issued', 'Issued')}: ${issueDate}`, canvas.width / 2, 760)
      ctx.fillStyle = '#F8FAFC'
      ctx.font = '700 22px monospace'
      ctx.fillText(`${translate('academy.cert.number', 'Certificate number')}: ${certificateId}`, canvas.width / 2, 805)
      ctx.fillStyle = '#94A3B8'
      ctx.font = '20px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(`${translate('academy.cert.issuer', 'Issuer')}: ${certificate.issuer}`, canvas.width / 2, 850)
      ctx.fillStyle = '#94A3B8'
      ctx.font = '18px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(
        translate('academy.cert.disclaimer', 'Server-verified assessment milestone; lesson reading is not verified. Not a professional license or academic degree.'),
        canvas.width / 2,
        970,
        canvas.width - 180,
      )
      ctx.fillStyle = '#00C2D7'
      ctx.font = '18px "Noto Sans Ethiopic", sans-serif'
      ctx.fillText(verificationUrl, canvas.width / 2, 1040, canvas.width - 180)

      const jpeg = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('CERTIFICATE_IMAGE_FAILED'))
        }, 'image/jpeg', 0.94)
      })
      const bytes = new Uint8Array(await jpeg.arrayBuffer())
      const pdf = createPdfWithJpegPages([
        { width: canvas.width, height: canvas.height, bytes },
      ], 'landscape')
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = `abbay-cyberguard-${certificateId.toLowerCase()}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(translate(
        'academy.cert.download_failed',
        'The PDF could not be created on this device. Please try again.',
      ))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
      className="academy-certificate-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="academy-certificate-dialog">
        <div className="academy-certificate-header">
          <h3 id="cert-modal-title">{translate('academy.cert.modal_title', 'Certificate of Completion')}</h3>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="academy-certificate-body">
          {!certificate && (
            <div className="academy-certificate-issue">
              <p>{translate('academy.cert.name_confirmation', 'Confirm the full name to print on your server-issued certificate.')}</p>
              <label htmlFor="certificate-recipient">{translate('academy.cert.recipient', 'Certificate recipient name')}</label>
              <input
                id="certificate-recipient"
                type="text"
                autoComplete="name"
                maxLength={200}
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
              <button type="button" className="btn primary" onClick={handleIssue} disabled={isIssuing}>
                {isIssuing
                  ? translate('academy.cert.issuing', 'Issuing…')
                  : translate('academy.cert.issue_btn', 'Issue certificate')}
              </button>
            </div>
          )}
          {error && <p className="msg error" role="alert">{error}</p>}
          <article className="academy-certificate-surface">
            <p className="academy-certificate-brand">ABBAY CYBERGUARD</p>
            <p className="academy-certificate-tagline">LEARN. PROTECT. EMPOWER.</p>
            <h2>{translate('academy.cert.document_title', 'CERTIFICATE OF ASSESSMENT MILESTONE')}</h2>
            <p>{translate('academy.cert.certifies', 'This record certifies that')}</p>
            <h1>{certificate?.recipient_name || recipientName || '—'}</h1>
            <p>{translate('academy.cert.completed_coursework', 'has passed the server-verified assessment milestone for')}</p>
            <h3>{certificate?.course_title || certData.title}</h3>
            {certificate ? (
              <dl className="academy-certificate-metadata">
                <div><dt>{translate('academy.cert.issued', 'Issued')}</dt><dd>{issueDate}</dd></div>
                <div><dt>{translate('academy.cert.number', 'Certificate number')}</dt><dd>{certificateId}</dd></div>
                <div><dt>{translate('academy.cert.status', 'Status')}</dt><dd>{certificate.status}</dd></div>
              </dl>
            ) : (
              <p className="academy-certificate-not-issued">{translate('academy.cert.not_issued', 'Preview only — not yet issued or verifiable.')}</p>
            )}
            <p className="academy-certificate-disclaimer">
              {translate('academy.cert.disclaimer', 'Server-verified assessment milestone; lesson reading is not verified. Not a professional license or academic degree.')}
            </p>
            {certificate && <p>{certificate.issuer}</p>}
          </article>
          {certificate && (
            <div className="academy-certificate-verification">
              <span>{translate('academy.cert.public_verification', 'Public verification link')}</span>
              <a href={verificationUrl}>{verificationUrl}</a>
            </div>
          )}
        </div>
        <div className="academy-certificate-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {translate('academy.cert.close', 'Close')}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleDownloadPdf}
            disabled={!certificate || isDownloading}
          >
            {isDownloading
              ? translate('academy.cert.generating_pdf', 'Generating PDF…')
              : translate('academy.cert.download_pdf', 'Download PDF')}
          </button>
        </div>
      </div>
    </div>
  )
}
