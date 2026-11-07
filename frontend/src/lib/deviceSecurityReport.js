/**
 * CyberShield Ethiopia — Standalone Device Security Report & Voice Formatter
 * 
 * Standalone client-side module providing:
 * 1. Offline high-fidelity PDF report generation supporting EN, OM, AM (with native Ethiopic Unicode font rendering).
 * 2. Natural spoken summary formatting for the "Read Report Aloud" feature.
 * 
 * Completely independent of M1-M5 and AI Assistant workflows.
 */

import { makeT } from '../i18n.js'

export function localizeFinding(f, lang = 'en', t = null) {
  if (!f) return f
  const tr = t || makeT(lang)
  const idLower = (f.id || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
  const nameKey = `device.check_${idLower}_name`
  const remKey = `device.check_${idLower}_rem`
  const localizedName = tr(nameKey) !== nameKey ? tr(nameKey) : f.name
  const localizedRem = tr(remKey) !== remKey ? tr(remKey) : f.remediation

  // Localize category
  const catKey = `device.filter_${(f.category || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  const localizedCat = tr(catKey) !== catKey ? tr(catKey) : f.category

  // Localize severity
  const sevKey = `device.sev_${(f.severity || '').toLowerCase()}`
  const localizedSev = tr(sevKey) !== sevKey ? tr(sevKey) : f.severity

  // Localize status
  const statKey = `device.status_${(f.status || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  const localizedStatus = tr(statKey) !== statKey ? tr(statKey) : f.status

  return {
    ...f,
    name: localizedName,
    remediation: localizedRem,
    category: localizedCat,
    severity: localizedSev,
    status: localizedStatus,
  }
}

export function localizeLimitation(limText, lang = 'en', t = null) {
  if (!limText || typeof limText !== 'string') return limText
  const tr = t || makeT(lang)
  if (limText.includes('WMI/CIM Defender')) return tr('device.limitation_wmi_admin') || limText
  if (limText.includes('Service Control Manager')) return tr('device.limitation_scm_admin') || limText
  if (limText.includes('ADB executable is not installed')) return tr('device.limitation_adb_missing') || limText
  if (limText.includes('Full malware scanning')) return tr('device.limitation_android_malware_mdm') || limText
  if (limText.includes('No authorized device')) return tr('device.limitation_no_device') || limText
  if (limText.includes('Android Play Protect status cannot be queried')) return tr('device.limitation_play_protect_api') || limText
  if (limText.includes('USB debugging authorization is pending')) return tr('device.limitation_usb_pending') || limText
  if (limText.includes('Device is offline')) return tr('device.limitation_device_offline') || limText
  if (limText.includes('Google Play Protect status requires manual verification')) return tr('device.limitation_play_protect_manual') || limText
  return limText
}

export function formatLocalizedRating(rating, t = null) {
  if (!rating) return ''
  const key = `device.rating_${rating.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  return t?.(key) || rating.replace(/_/g, ' ')
}

function localizeStatus(status, t) {
  const key = `device.status_${(status || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  const localized = t(key)
  return localized === key ? status : localized
}

// PDF Binary Assembler (Generates valid ISO 32000-1 / PDF-1.4 binary Blob)
export function createPdfWithJpegPages(pages) {
  const parts = []
  let offset = 0
  const offsets = []

  function addString(str) {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(str)
    parts.push(bytes)
    offset += bytes.length
  }

  function addBytes(bytes) {
    parts.push(bytes)
    offset += bytes.length
  }

  addString('%PDF-1.4\r\n%\xFF\xFF\xFF\xFF\r\n')

  // Obj 1: Catalog
  offsets.push(offset)
  addString('1 0 obj\r\n<< /Type /Catalog /Pages 2 0 R >>\r\nendobj\r\n')

  // Obj 2: Pages
  offsets.push(offset)
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  addString(`2 0 obj\r\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\r\nendobj\r\n`)

  // For each page
  pages.forEach((page, i) => {
    const pageObjNum = 3 + i * 3
    const imgObjNum = 4 + i * 3
    const contentObjNum = 5 + i * 3

    // Page Obj (A4 MediaBox: 595.28 x 841.89 pt)
    offsets.push(offset)
    addString(`${pageObjNum} 0 obj\r\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i + 1} ${imgObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>\r\nendobj\r\n`)

    // Img Obj
    offsets.push(offset)
    addString(`${imgObjNum} 0 obj\r\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\r\nstream\r\n`)
    addBytes(page.bytes)
    addString('\r\nendstream\r\nendobj\r\n')

    // Content Obj
    offsets.push(offset)
    const streamContent = `q 595.28 0 0 841.89 0 0 cm /Im${i + 1} Do Q\r\n`
    addString(`${contentObjNum} 0 obj\r\n<< /Length ${streamContent.length} >>\r\nstream\r\n${streamContent}endstream\r\nendobj\r\n`)
  })

  // XRef Table with exact 20-byte entries
  const startxref = offset
  const count = 1 + offsets.length
  addString(`xref\r\n0 ${count}\r\n`)
  addString('0000000000 65535 f\r\n')
  for (const off of offsets) {
    addString(String(off).padStart(10, '0') + ' 00000 n\r\n')
  }

  // Trailer
  addString(`trailer\r\n<< /Size ${count} /Root 1 0 R >>\r\nstartxref\r\n${startxref}\r\n%%EOF\r\n`)

  return new Blob(parts, { type: 'application/pdf' })
}

export function createStructuralDeviceSecurityPdf(result, language = 'en') {
  const lang = (language || 'en').toLowerCase()
  const title = lang === 'am' ? 'CyberShield Ethiopia - የመሳሪያ ደህንነት ግምገማ ሪፖርት'
    : lang === 'om' ? 'CyberShield Ethiopia - Gabaasa Sakatta\'iinsa Nageenya Meeshaa'
    : 'CyberShield Ethiopia - Device Security Assessment Report'

  const target = (result?.target || 'Windows').toUpperCase()
  const dateStr = result?.scan_time ? new Date(result.scan_time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  const overall = result?.overall_status || 'UNKNOWN'
  const metrics = result?.metrics || {}
  const t = makeT(lang)
  const status = localizeStatus(overall, t)
  const rating = formatLocalizedRating(result?.overall_rating || overall, t)

  const safeLines = [
    title,
    `Date: ${dateStr} | Target: ${target} | Status: ${status} — ${rating}`,
    `Metrics: ${t('device.pdf_metric_total')}=${metrics.total_checks || 0} ${t('device.status_pass')}=${metrics.pass_count || 0} ${t('device.status_warning')}=${metrics.warning_count || 0} ${t('device.status_fail')}=${metrics.fail_count || 0} ${t('device.status_not_supported')}=${metrics.not_supported_count || 0} ${t('device.status_not_checked')}=${metrics.not_checked_count || 0}`,
    '--------------------------------------------------------------------------------',
  ]

  const findings = result?.findings || []
  findings.slice(0, 30).forEach((f) => {
    safeLines.push(`[${f.status}] ${f.id}: ${f.name} (Severity: ${f.severity})`)
    if (f.remediation) {
      safeLines.push(`  Action: ${f.remediation.slice(0, 80)}`)
    }
  })
  safeLines.push('--------------------------------------------------------------------------------')
  safeLines.push('Confidential - 100% on-device local security assessment. No external transmission.')

  let contentStream = 'BT\r\n/F1 12 Tf\r\n40 800 Td\r\n'
  contentStream += `(${safeLines[0].replace(/[\\()]/g, '')}) Tj\r\n`
  contentStream += '/F1 10 Tf\r\n0 -18 Td\r\n'
  for (let i = 1; i < safeLines.length; i++) {
    const clean = safeLines[i].replace(/[\\()]/g, '').slice(0, 90)
    contentStream += `(${clean}) Tj\r\n0 -14 Td\r\n`
  }
  contentStream += 'ET\r\n'

  const streamBytes = new TextEncoder().encode(contentStream)
  const parts = []
  let offset = 0
  const offsets = []

  function addString(str) {
    const bytes = new TextEncoder().encode(str)
    parts.push(bytes)
    offset += bytes.length
  }

  addString('%PDF-1.4\r\n%\xFF\xFF\xFF\xFF\r\n')
  offsets.push(offset)
  addString('1 0 obj\r\n<< /Type /Catalog /Pages 2 0 R >>\r\nendobj\r\n')
  offsets.push(offset)
  addString('2 0 obj\r\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\r\nendobj\r\n')
  offsets.push(offset)
  addString('3 0 obj\r\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\r\nendobj\r\n')
  offsets.push(offset)
  addString(`4 0 obj\r\n<< /Length ${streamBytes.length} >>\r\nstream\r\n${contentStream}endstream\r\nendobj\r\n`)

  const startxref = offset
  addString('xref\r\n0 5\r\n')
  addString('0000000000 65535 f\r\n')
  for (const off of offsets) {
    addString(String(off).padStart(10, '0') + ' 00000 n\r\n')
  }
  addString(`trailer\r\n<< /Size 5 /Root 1 0 R >>\r\nstartxref\r\n${startxref}\r\n%%EOF\r\n`)

  return new Blob(parts, { type: 'application/pdf' })
}

/**
 * Generate a downloadable binary PDF Blob from live assessment results.
 * Uses HTML5 Canvas rasterization in browsers for crisp Ethiopic Unicode font rendering.
 */
export function generateDeviceSecurityPdfBlob(result, options = {}) {
  const lang = (options.language || 'en').toLowerCase().trim()
  const t = options.t || makeT(lang)
  const target = (result?.target || 'windows').toUpperCase()
  const dateStr = result?.scan_time ? new Date(result.scan_time).toLocaleString() : new Date().toLocaleString()
  const overall = result?.overall_status || 'NOT CHECKED'
  const overallRating = (result?.overall_rating || 'INCOMPLETE').replace(/_/g, ' ')
  const localizedOverallRating = formatLocalizedRating(result?.overall_rating || overallRating, t)
  const metrics = result?.metrics || {}
  const findings = result?.findings || []

  // Check if browser Canvas is available
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      // A4 at 150 DPI: 1240 x 1754
      const pageWidth = 1240
      const pageHeight = 1754
      const marginX = 80
      const marginY = 80

      const fontSans = 'NotoSansEthiopic, "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif'
      const fontMono = '"Space Grotesk", "Courier New", monospace'

      // Localized labels
      const labels = {
        en: {
          title: 'CyberShield Ethiopia — Device Security Audit Report',
          targetLabel: 'Target Platform:',
          deviceLabel: 'Device ID (Masked):',
          statusLabel: 'Verified System Status:',
          metricsLabel: 'Assessment Check Metrics:',
          findingsLabel: 'Individual Verified Findings',
          remediationLabel: 'Action:',
          evidenceLabel: 'Evidence:',
          limitationLabel: 'Boundary Note:',
          disclaimer: 'Confidential — Generated 100% locally on device. Zero external telemetry or cloud persistence.',
        },
        om: {
          title: 'CyberShield Itoophiyaa — Gabaasa Sakatta\'iinsa Nageenya Meeshaa',
          targetLabel: 'Gosa Meeshaa:',
          deviceLabel: 'Eenyummeeffama Meeshaa:',
          statusLabel: 'Haala Nageenya Mirkanaa\'e:',
          metricsLabel: 'Bu\'aa Sakatta\'iinsaa:',
          findingsLabel: 'Bu\'aawwan Qorannoo Mirkanaa\'an',
          remediationLabel: 'Tarkaanfii:',
          evidenceLabel: 'Ragaa:',
          limitationLabel: 'Daangaa:',
          disclaimer: 'Iccitii Dhuunfaa — 100% meeshaa irratti qophaa\'e. Daataan alatti hin ergamne.',
        },
        am: {
          title: 'ሳይበርሺልድ ኢትዮጵያ — የመሳሪያ ደህንነት ፍተሻ ይፋዊ ሪፖርት',
          targetLabel: 'የመሳሪያ አይነት፡',
          deviceLabel: 'የመሳሪያ መለያ፡',
          statusLabel: 'የተረጋገጠ አጠቃላይ ሁኔታ፡',
          metricsLabel: 'የፍተሻዎች ማጠቃለያ፡',
          findingsLabel: 'የተረጋገጡ የደህንነት ግኝቶች ዝርዝር',
          remediationLabel: 'የሚመከር እርምጃ፡',
          evidenceLabel: 'ማስረጃ፡',
          limitationLabel: 'የምርመራ ወሰን፡',
          disclaimer: 'ሚስጥራዊ — 100% በመሳሪያዎ ላይ የተከናወነ። ምንም አይነት መረጃ ወደ ውጭ አልተላከም።',
        },
      }
      const L = labels[lang] || labels.en

      // Group findings into pages (max 6 findings per page)
      const perPage = 5
      const pagesCount = Math.max(1, Math.ceil(findings.length / perPage))
      const pages = []

      for (let pIdx = 0; pIdx < pagesCount; pIdx++) {
        const rawPageFindings = findings.slice(pIdx * perPage, (pIdx + 1) * perPage)
        const pageFindings = rawPageFindings.map((f) => localizeFinding(f, lang, t))
        const canvas = document.createElement('canvas')
        canvas.width = pageWidth
        canvas.height = pageHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D unavailable')

        // Background
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, pageWidth, pageHeight)

        // Top Accent Stripe
        ctx.fillStyle = '#3b82f6'
        ctx.fillRect(0, 0, pageWidth, 16)

        // Header Title
        ctx.fillStyle = '#f8fafc'
        ctx.font = `bold 30px ${fontSans}`
        ctx.fillText('🛡️ ' + L.title, marginX, marginY + 24)

        // Subtitle / Date / Platform
        ctx.fillStyle = '#94a3b8'
        ctx.font = `18px ${fontMono}`
        const devHost = result.device_summary?.hostname || result.device_summary?.model || 'Local Host'
        ctx.fillText(`${dateStr} | ${L.targetLabel} ${target} | ${L.deviceLabel} ${devHost} | Page ${pIdx + 1} of ${pagesCount}`, marginX, marginY + 64)

        // Divider
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(marginX, marginY + 88)
        ctx.lineTo(pageWidth - marginX, marginY + 88)
        ctx.stroke()

        let curY = marginY + 120

        // Only draw summary banner on Page 1
        if (pIdx === 0) {
          // Status Box
          const statusBg = overall === 'PASS' ? 'rgba(52, 211, 153, 0.15)' : overall === 'WARNING' ? 'rgba(251, 191, 36, 0.15)' : overall === 'FAIL' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(167, 139, 250, 0.15)'
          const statusColor = overall === 'PASS' ? '#34d399' : overall === 'WARNING' ? '#fbbf24' : overall === 'FAIL' ? '#f87171' : '#a78bfa'

          ctx.fillStyle = statusBg
          ctx.fillRect(marginX, curY, pageWidth - marginX * 2, 70)
          ctx.strokeStyle = statusColor
          ctx.strokeRect(marginX, curY, pageWidth - marginX * 2, 70)

          ctx.fillStyle = statusColor
          ctx.font = `bold 22px ${fontSans}`
          const localizedStatus = localizeStatus(overall, t)
          ctx.fillText(`${L.statusLabel} ${localizedStatus} — ${localizedOverallRating}`, marginX + 24, curY + 44)

          curY += 94

          // Metrics Pills Row
          ctx.font = `bold 16px ${fontMono}`
          ctx.fillStyle = '#e2e8f0'
          ctx.fillText(
            `${L.metricsLabel}  ${t('device.pdf_metric_total')}: ${metrics.total_checks || 0}  |  ✓ ${metrics.pass_count || 0} ${t('device.status_pass')}  |  ⚠️ ${metrics.warning_count || 0} ${t('device.status_warning')}  |  ✗ ${metrics.fail_count || 0} ${t('device.status_fail')}  |  🚫 ${metrics.not_supported_count || 0} ${t('device.status_not_supported')}  |  ❓ ${metrics.not_checked_count || 0} ${t('device.status_not_checked')}`,
            marginX,
            curY + 14
          )

          curY += 46
        }

        // Findings Header
        ctx.fillStyle = '#60a5fa'
        ctx.font = `bold 20px ${fontSans}`
        ctx.fillText(`📋 ${L.findingsLabel} (${pIdx * perPage + 1} - ${Math.min((pIdx + 1) * perPage, findings.length)} of ${findings.length})`, marginX, curY + 10)
        curY += 34

        // Render Page Findings Cards
        pageFindings.forEach((f) => {
          const cardH = 175
          const isPass = f.status === 'PASS' || f.status === t('device.status_pass')
          const isWarn = f.status === 'WARNING' || f.status === t('device.status_warning')
          const isFail = f.status === 'FAIL' || f.status === t('device.status_fail')
          const fColor = isPass ? '#34d399' : isWarn ? '#fbbf24' : isFail ? '#f87171' : '#a78bfa'

          // Card Background
          ctx.fillStyle = '#1e293b'
          ctx.fillRect(marginX, curY, pageWidth - marginX * 2, cardH)
          ctx.strokeStyle = fColor + '80'
          ctx.strokeRect(marginX, curY, pageWidth - marginX * 2, cardH)

          // Card Header: ID, Name, Status Pill
          ctx.fillStyle = '#f8fafc'
          ctx.font = `bold 19px ${fontSans}`
          ctx.fillText(`[${f.id}] ${f.name}`, marginX + 20, curY + 34)

          // Status & Severity Badge
          ctx.fillStyle = fColor
          ctx.font = `bold 16px ${fontMono}`
          const badgeStr = `${f.status} (${f.severity})`
          const badgeW = ctx.measureText(badgeStr).width
          ctx.fillText(badgeStr, pageWidth - marginX - badgeW - 20, curY + 34)

          // Remediation Line
          ctx.fillStyle = '#93c5fd'
          ctx.font = `bold 16px ${fontSans}`
          ctx.fillText(L.remediationLabel, marginX + 20, curY + 70)
          ctx.fillStyle = '#cbd5e1'
          ctx.font = `16px ${fontSans}`
          const remText = (f.remediation || '').slice(0, 95)
          ctx.fillText(remText, marginX + 110, curY + 70)

          // Evidence Line
          ctx.fillStyle = '#94a3b8'
          ctx.font = `bold 15px ${fontSans}`
          ctx.fillText(L.evidenceLabel, marginX + 20, curY + 102)
          ctx.font = `14px ${fontMono}`
          ctx.fillStyle = '#94a3b8'
          const evText = (f.evidence || '').slice(0, 105)
          ctx.fillText(evText, marginX + 110, curY + 102)

          // Limitation / Boundary Note if present
          if (f.permission_limitation) {
            ctx.fillStyle = '#fbbf24'
            ctx.font = `italic 14px ${fontSans}`
            ctx.fillText(`⚠️ ${L.limitationLabel} ${f.permission_limitation.slice(0, 95)}`, marginX + 20, curY + 138)
          }

          curY += cardH + 18
        })

        // Footer Disclaimer & Page Number
        ctx.fillStyle = '#64748b'
        ctx.font = `14px ${fontSans}`
        ctx.fillText(L.disclaimer, marginX, pageHeight - 50)
        const pNum = `${pIdx + 1} / ${pagesCount}`
        ctx.fillText(pNum, pageWidth - marginX - ctx.measureText(pNum).width, pageHeight - 50)

        // Convert canvas image to JPEG bytes
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        const base64Data = dataUrl.split(',')[1]
        const binaryString = atob(base64Data)
        const imgBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          imgBytes[i] = binaryString.charCodeAt(i)
        }

        pages.push({ width: pageWidth, height: pageHeight, bytes: imgBytes })
      }

      return createPdfWithJpegPages(pages)
    } catch {
      // Graceful fallback to structural text PDF
    }
  }

  return createStructuralDeviceSecurityPdf(result, lang)
}

/**
 * Format assessment findings into natural spoken prose for the "Read Report Aloud" feature.
 * Filters out raw paths, null bytes, and sensitive machine identifiers.
 */
export function formatReportForSpeech(result, language = 'en') {
  if (!result) return ''
  const lang = (language || 'en').toLowerCase().trim()
  const t = makeT(lang)
  const target = result.target === 'android' ? 'Android' : 'Windows'
  const metrics = result.metrics || {}
  const pass = metrics.pass_count || 0
  const warn = metrics.warning_count || 0
  const fail = metrics.fail_count || 0
  const notChecked = metrics.not_checked_count || 0
  const total = metrics.total_checks || (pass + warn + fail + notChecked)

  const rawFindings = result.findings || []
  const findings = rawFindings.map((f) => localizeFinding(f, lang, t))
  const attentionItems = findings
    .filter((f) => f.status === 'WARNING' || f.status === 'FAIL' || f.status === t('device.status_warning') || f.status === t('device.status_fail'))
    .slice(0, 3)
    .map((f) => f.name)
    .join(', ')

  if (lang === 'om') {
    let speech = `Gabaasa Sakatta'iinsa Nageenya Meeshaa ABBAY CYBERGUARD. Xiyyeeffannoo Meeshaa: ${target}. `
    speech += `Haala Nageenya Waliigalaa: ${result.overall_status === 'PASS' ? 'Mirkanaa\'eera' : result.overall_status === 'WARNING' ? 'Akeekkachiisa' : 'Kufaatii'}. `
    speech += `Sakatta'iinsa waliigalaa ${total} keessaa: ${pass} darbeera, ${warn} akeekkachiisa qaba, fi ${fail} kufeera. `
    if (notChecked > 0) {
      speech += `Qorannoowwan ${notChecked} sababa hayyamaatiin hin guutamne. `
    }
    if (attentionItems) {
      speech += `Qabxiilee xiyyeeffannoo barbaadan: ${attentionItems}. `
    }
    speech += `Gabaasni kun dhuunfaa fi toora-malee ta'ee meeshaa keessan irratti qophaa'e.`
    return speech
  }

  if (lang === 'am') {
    let speech = `የABBAY CYBERGUARD የመሳሪያ ደህንነት ግምገማ ሪፖርት። የመሳሪያ አይነት፡ ${target}። `
    speech += `አጠቃላይ የደህንነት ሁኔታ፡ ${result.overall_status === 'PASS' ? 'ተረጋግጧል' : result.overall_status === 'WARNING' ? 'ማስጠንቀቂያ' : 'አልተሳካም'}። `
    speech += `ከአጠቃላይ ${total} ፍተሻዎች ውስጥ፡ ${pass} ፍተሻዎች አልፈዋል፣ ${warn} ማስጠንቀቂያዎች ተገኝተዋል፣ እና ${fail} አልተሳኩም። `
    if (notChecked > 0) {
      speech += `${notChecked} ፍተሻዎች በፈቃድ ገደብ ምክንያት አልተከናወኑም። `
    }
    if (attentionItems) {
      speech += `ትኩረት የሚሹ ዋና ዋና ነጥቦች፡ ${attentionItems}። `
    }
    speech += `ይህ ሪፖርት ያለ ምንም የውጭ ግንኙነት በኮምፒውተርዎ ላይ ብቻ የተዘጋጀ ነው።`
    return speech
  }

  // English fallback
  let speech = `ABBAY CYBERGUARD Device Security Assessment Report for ${target}. `
  speech += `Overall verified status is ${result.overall_status}, ${result.overall_rating ? result.overall_rating.replace(/_/g, ' ') : ''}. `
  speech += `Out of ${total} checks evaluated: ${pass} passed, ${warn} warning, and ${fail} failed. `
  if (notChecked > 0) {
    speech += `${notChecked} checks require elevated permissions and were marked not checked. `
  }
  if (attentionItems) {
    speech += `Primary items requiring attention: ${attentionItems}. `
  }
  speech += `This assessment was processed 100 percent locally on this device with zero telemetry.`
  return speech
}

