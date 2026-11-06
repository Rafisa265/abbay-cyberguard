// M3 — report drafting; everything stays in browser memory (SR-09).
import incidentWeights from './incidentModelWeights.js'

export const INCIDENT_KEYWORD_GROUPS = {
  otp_secret: [
    'otp', 'one-time', 'verification code', 'secret code',
    'koodii', 'iccitii', 'koodii mirkaneessaa',
    'ኦቲፒ', 'ሚስጥር ቁጥር', 'የማረጋገጫ ኮድ', 'ኮድ',
  ],
  sim_deactivation: [
    'sim', 'sim card', 'deactivation', 'deactivate', 'disconnect', 'cellular', 'tower',
    'kaardii', 'cufama', 'tajaajila ala',
    'ሲም', 'ሲም ካርድ', 'መዘጋት', 'ይዘጋል',
  ],
  telecom_brand: [
    'telecom', 'ethio telecom', '994', 'carrier',
    'telekoomii', 'itoophiyaa telekoom',
    'ቴሌኮም', 'ኢትዮ ቴሌኮም',
  ],
  mobile_money_brand: [
    'telebirr', '127', 'cbe birr', 'cbebirr', 'birr', 'etb',
    'qarshii',
    'ቴሌብር', 'ሲቢኢ ብር', 'ብር',
  ],
  mistaken_transfer: [
    'transfer', 'transferred', 'mistaken', 'accidental', 'refund', 'reverse', 'sent to you',
    'dabarsa', 'dogoggoraan', 'deebisi', 'ergameera',
    'ዝውውር', 'በስህተት', 'መልስ', 'ተልኮልዎታል',
  ],
  lottery_prize: [
    'lottery', 'won', 'prize', 'winner', 'reward', 'congratulations',
    'mooteetta', 'badhaasa', 'badhaafamte',
    'ሎተሪ', 'ሽልማት', 'አሸነፉ', 'እንኳን ደስ አለዎት',
  ],
  advance_fee: [
    'fee', 'processing fee', 'upfront', 'registration fee', 'send fee',
    'kaffaltii', 'dursanii',
    'ክፍያ', 'ቅድመ ክፍያ', 'የምዝገባ ክፍያ',
  ],
  bank_financial: [
    'bank', 'cbe', 'commercial bank', 'account number', 'banking app', 'atm',
    'baankii', 'herrega', 'baankii daldalaa',
    'ባንክ', 'ንግድ ባንክ', 'የባንክ ሂሳብ',
  ],
  password_credentials: [
    'password', 'passcode', 'pin', 'credentials', 'login details', 'passphrase',
    'jecha darbii', 'lakkoofsa iccitii',
    'የይለፍ ቃል', 'የይለፍ', 'ፒን', 'ሚስጥር',
  ],
  link_fake_site: [
    'link', 'url', 'website', 'click', 'tapped', 'form',
    'linkii', 'marsariitii', 'tuqe',
    'ሊንክ', 'ድረ-ገጽ', 'ይጫኑ', 'ነካሁ',
  ],
  portal_scholarship: [
    'portal', 'university', 'student', 'scholarship', 'admission', 'grade',
    'barataa', 'yuunivarsiitii',
    'ፖርታል', 'ዩኒቨርሲቲ', 'ተማሪ', 'ስኮላርሺፕ',
  ],
  apk_download: [
    'apk', 'app', 'download', 'downloaded', 'install', 'installed', 'sideload',
    'buusee', "fe'uu", 'appilikeeshinii',
    'ኤፒኬ', 'መተግበሪያ', 'አወረድኩ', 'ጫንኩ',
  ],
  accessibility_perm: [
    'accessibility', 'permission', 'administrator', 'device admin', 'granted',
    'heyyama',
    'ፈቃድ', 'የአንድሮይድ ፈቃድ', 'ቁጥጥር',
  ],
  malware_trojan: [
    'trojan', 'malware', 'virus', 'booster', 'unauthorized app',
    'summii',
    'ቫይረስ', 'ተንኮል አዘል', 'ማልዌር',
  ],
  account_takeover: [
    'hijack', 'hijacked', 'hacked', 'locked out', 'logged out', 'stolen account', 'changed password',
    'jijjiirame', 'hatame', 'saamame', 'cufameera',
    'ተጠለፈ', 'ተሰረቀ', 'ተዘጋብኝ', 'የይለፍ ቃሌ ተቀየረ',
  ],
  telegram_messaging: [
    'telegram', 'bot', 'channel', 'group', 'whatsapp',
    'telegiraamii', 'bootii',
    'ቴሌግራም', 'ቦት', 'ቻናል',
  ],
  threat_urgency: [
    'urgent', 'suspended', 'suspend', 'hours', 'immediate', 'immediately', 'deadline',
    'sardama', 'ariifachiisaa', 'dafii',
    'አስቸኳይ', 'አሁኑኑ', 'እገዳ', 'ይታገዳል', 'ሰዓት',
  ],
  monetary_loss: [
    'lost money', 'stole', 'drained', 'unauthorized debit', 'deducted',
    'dhabe', 'saamame', 'baafame',
    'ተዘረፍኩ', 'ተወሰደብኝ', 'ገንዘብ ወጣብኝ', 'ተቆረጠ',
  ],
}

export function extractIncidentFeatures(text) {
  if (!text || typeof text !== 'string') {
    return { vector: new Array(18).fill(0.0), detected: [] }
  }
  const clean = text
    .toLowerCase()
    .replace(/[\u1361-\u1368\s,.:;!?'"()[\]{}/\\_-]+/g, ' ')
    .trim()

  const groupKeys = incidentWeights.FEATURE_NAMES
  const vector = []
  const detected = []

  for (const group of groupKeys) {
    const keywords = INCIDENT_KEYWORD_GROUPS[group] || []
    let matches = 0
    let firstMatched = ''
    for (const kw of keywords) {
      if (clean.includes(kw)) {
        matches++
        if (!firstMatched) firstMatched = kw
      }
    }
    if (matches > 0) {
      const val = Math.round(Math.min(1.0, 0.4 + matches * 0.2) * 10000) / 10000
      vector.push(val)
      detected.push(`${group}:${firstMatched}`)
    } else {
      vector.push(0.0)
    }
  }

  return { vector, detected }
}

export function predictIncidentType(text) {
  const { vector, detected } = extractIncidentFeatures(text)
  const hasSignals = vector.some((v) => v > 0)
  if (!hasSignals) {
    return null
  }

  const logits = incidentWeights.WEIGHTS.map((wRow, classIdx) => {
    let dot = incidentWeights.BIASES[classIdx]
    for (let i = 0; i < vector.length; i++) {
      dot += wRow[i] * vector[i]
    }
    return dot
  })
  const maxL = Math.max(...logits)
  const exp = logits.map((z) => Math.exp(z - maxL))
  const sumExp = exp.reduce((a, b) => a + b, 0)
  const probs = exp.map((v) => v / sumExp)

  let bestIdx = 0
  let bestProb = probs[0]
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > bestProb) {
      bestProb = probs[i]
      bestIdx = i
    }
  }

  const predictedClass = incidentWeights.CLASSES[bestIdx]
  const confidence = Math.round(bestProb * 10000) / 10000

  const probMap = {}
  incidentWeights.CLASSES.forEach((c, i) => {
    probMap[c] = Math.round(probs[i] * 10000) / 10000
  })

  return {
    engine: 'ml_m3_incident_v1',
    predictedClass,
    confidence,
    isConfident: confidence >= incidentWeights.CONFIDENCE_THRESHOLD,
    probabilities: probMap,
    detectedIndicators: detected,
    evaluation: incidentWeights.EVALUATION_METRICS,
  }
}

export const luhn = (digits) => {
  if (!digits || typeof digits !== 'string') return false
  const clean = digits.replace(/\D/g, '')
  if (clean.length < 13 || clean.length > 19 || /^0+$/.test(clean)) return false
  let sum = 0, alt = false
  for (let i = clean.length - 1; i >= 0; i--) {
    let d = +clean[i]
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

export function sensitiveFlags(text) {
  if (!text || typeof text !== 'string') return []
  const flags = new Set()

  // 1. Credit / Debit card patterns via Luhn algorithm (13-19 digits)
  for (const m of text.matchAll(/\b\d(?:[ -]?\d){12,18}\b/g)) {
    const raw = m[0].replace(/\D/g, '')
    if (luhn(raw)) {
      flags.add('card')
    }
  }

  // 2. Secret credentials & tokens across EN, OM, AM
  // English: password, passcode, pin, otp, verification code, cvv, one-time code
  // Amharic: የይለፍ ቃል, ፒን, ኦቲፒ, የማረጋገጫ ኮድ, ሚስጥር ቁጥር
  // Afaan Oromoo: jecha darbii, lakkoofsa iccitii, koodii mirkaneessaa, koodii iccitii
  const secretPattern = new RegExp(
    '\\b(password|passcode|pin|otp|verification code|one[- ]time (code|password)|cvv|cvc)\\b\\s*(is|was|:|=)?\\s*\\S*\\d\\S*|' +
    '\\b(password|passcode)\\b\\s*(is|was|:|=)\\s*\\S+|' +
    '(የይለፍ[\\s_]?ቃል|ፒን|ኦቲፒ|የማረጋገጫ[\\s_]?ኮድ|ሚስጥር[\\s_]?ቁጥር|የሚስጥር[\\s_]?ቁጥር)\\s*[:=፣]?\\s*\\S+|' +
    '\\b(jecha\\s+darbii|lakkoofsa\\s+iccitii|koodii\\s+mirkaneessaa|koodii\\s+iccitii)\\b\\s*[:=]?\\s*\\S+',
    'i'
  )
  if (secretPattern.test(text)) {
    flags.add('secret')
  }

  // 3. Long digit sequences (9+ consecutive digits, including national ID, CBE account, phone)
  if (/\b\d{9,}\b/.test(text.replace(/(?<=\d)[ -](?=\d)/g, ''))) {
    flags.add('longdigits')
  }

  return [...flags]
}

export const TYPES = ['fraud', 'phishing', 'takeover', 'malware', 'sim_otp', 'privacy', 'harassment', 'other']
export const METHODS = ['', 'phone', 'message', 'email', 'website', 'social', 'other']
export const LOSSES = ['', 'none', 'money', 'access', 'data', 'other']

/**
 * Deterministic, rule-based triage assessment
 * Evaluates severity level (urgent, high, medium, low) and status (confirmed, suspected)
 */
export function triageIncident(data, customFlags = null) {
  const d = data || {}
  const flags = customFlags || sensitiveFlags([d.what || '', d.evidence || '', d.suspect || ''].join(' '))
  const reasons = []

  // Check specific indicators
  const hasMonetaryLoss = d.loss === 'money' || (typeof d.amount === 'string' && d.amount.trim().length > 0)
  const hasAccessLoss = d.loss === 'access' || d.type === 'takeover'
  const hasSecretExposed = flags.includes('secret')
  const hasCardExposed = flags.includes('card')
  const hasLongDigits = flags.includes('longdigits')
  const isSimOtp = d.type === 'sim_otp'
  const isMalware = d.type === 'malware'
  const isPhishing = d.type === 'phishing'
  const isPrivacy = d.type === 'privacy' || d.loss === 'data'

  // Severity Evaluation
  let severity = 'low'
  if (hasMonetaryLoss || isSimOtp || (hasAccessLoss && hasSecretExposed)) {
    severity = 'urgent'
  } else if (hasAccessLoss || isMalware || hasSecretExposed || hasCardExposed) {
    severity = 'high'
  } else if (isPhishing || isPrivacy || d.type === 'harassment' || hasLongDigits) {
    severity = 'medium'
  } else {
    severity = 'low'
  }

  // Status Evaluation (Confirmed vs Suspected)
  const status = (hasMonetaryLoss || hasAccessLoss) ? 'confirmed' : 'suspected'

  // Triage Reasons
  if (hasMonetaryLoss) reasons.push('m3.triage.reason.financial')
  if (hasSecretExposed || hasCardExposed) reasons.push('m3.triage.reason.credentials')
  if (hasAccessLoss) reasons.push('m3.triage.reason.account_compromise')
  if (isMalware) reasons.push('m3.triage.reason.malware')
  if (isSimOtp) reasons.push('m3.triage.reason.sim_otp')
  if (isPhishing) reasons.push('m3.triage.reason.phishing')
  if (isPrivacy) reasons.push('m3.triage.reason.data_exposure')
  if (reasons.length === 0) reasons.push('m3.triage.reason.low_impact')

  return { severity, status, reasons }
}

/**
 * Deterministically sorts timeline events chronologically
 * Preserves events with unknown dates at the end without fabricating timestamps
 */
export function sortTimelineEvents(timeline) {
  if (!Array.isArray(timeline)) return []
  const valid = timeline.filter((e) => e && typeof e.description === 'string' && e.description.trim().length > 0)

  return [...valid].sort((a, b) => {
    const aDate = (a.date || '').trim()
    const bDate = (b.date || '').trim()

    // Both have dates -> sort chronologically
    if (aDate && bDate) {
      const cmpDate = aDate.localeCompare(bDate)
      if (cmpDate !== 0) return cmpDate
      return (a.time || '').localeCompare(b.time || '')
    }
    // Items with dates come before items without dates
    if (aDate && !bDate) return -1
    if (!aDate && bDate) return 1
    return 0
  })
}

export function validate(d, today = new Date()) {
  const data = d || {}
  const e = {}

  if (!TYPES.includes(data.type)) e.type = 'required'

  if (!data.date) {
    e.date = 'required'
  } else if (Number.isNaN(Date.parse(data.date))) {
    e.date = 'required'
  } else if (new Date(data.date + 'T00:00:00') > today) {
    e.date = 'future'
  } else if (new Date(data.date + 'T00:00:00').getFullYear() < 1990) {
    e.date = 'required'
  }

  if (!data.what?.trim()) {
    e.what = 'required'
  } else if (data.what.length > 3000) {
    e.what = 'toolong'
  }

  if (data.reporter?.trim()) {
    const rep = data.reporter.trim()
    if (rep.length > 200) {
      e.reporter = 'toolong'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rep) && !/^\+?[\d\s()-]{7,20}$/.test(rep)) {
      e.reporter = 'contact'
    }
  }

  for (const k of ['suspect', 'evidence', 'amount']) {
    if ((data[k] || '').length > 1000) {
      e[k] = 'toolong'
    }
  }

  return e
}

export function buildDraft(d, t, today = new Date()) {
  const data = d || {}
  const triage = triageIncident(data)
  const sortedTimeline = sortTimelineEvents(data.timeline || [])

  const L = [
    `${t('m3.d.title')} — ${today.toISOString().slice(0, 10)}`,
    '',
    `${t('m3.d.type')}: ${t('m3.type.' + data.type)}`,
    `${t('m3.d.date')}: ${data.date}`,
    '',
    `${t('m3.d.what')}:`,
    (data.what || '').trim(),
  ]

  if (data.method) L.push('', `${t('m3.d.method')}: ${t('m3.method.' + data.method)}`)
  if (data.suspect?.trim()) L.push('', `${t('m3.d.suspect')}: ${data.suspect.trim()}`)
  if (data.loss || data.amount?.trim()) L.push('', `${t('m3.d.loss')}: ${data.loss ? t('m3.loss.' + data.loss) : ''} ${data.amount?.trim() || ''}`.trimEnd())
  if (data.evidence?.trim()) L.push('', `${t('m3.d.evidence')}: ${data.evidence.trim()}`)
  if (data.reporter?.trim()) L.push('', `${t('m3.d.reporter')}: ${data.reporter.trim()}`)

  // Triage Assessment Section
  L.push('', '---', `${t('m3.d.triage')}:`)
  L.push(`• ${t('m3.d.severity')}: ${t('m3.severity.' + triage.severity)}`)
  L.push(`• ${t('m3.d.status')}: ${t('m3.status.' + triage.status)}`)
  if (triage.reasons && triage.reasons.length > 0) {
    L.push(`• ${t('m3.triage.reasons_title')}:`)
    for (const r of triage.reasons) {
      L.push(`  - ${t(r)}`)
    }
  }

  // Chronological Event Timeline (when provided)
  if (sortedTimeline.length > 0) {
    L.push('', '---', `${t('m3.d.timeline')}:`)
    for (const ev of sortedTimeline) {
      const timeStr = ev.time ? ` ${ev.time}` : ''
      const dateStr = ev.date ? `${ev.date}${timeStr}` : t('m3.timeline.unknown')
      L.push(`• [${dateStr}] ${ev.description.trim()}`)
    }
  }

  // Incident Response Plan (tailored recommendations)
  L.push('', '---', `${t('m3.d.recs')}:`)
  if (data.loss === 'money' || data.amount?.trim() || data.type === 'fraud') {
    L.push(t('m3.rec.financial'))
  }
  if (data.type === 'takeover' || data.loss === 'access') {
    L.push(t('m3.rec.account'))
  }
  if (data.type === 'phishing' || data.method === 'website' || data.method === 'email') {
    L.push(t('m3.rec.phishing'))
  }
  if (data.type === 'malware') {
    L.push(t('m3.rec.malware'))
  }
  if (data.type === 'sim_otp') {
    L.push(t('m3.rec.sim_otp'))
  }
  if (data.type === 'privacy' || data.loss === 'data') {
    L.push(t('m3.rec.privacy'))
  }
  L.push(t('m3.rec.evidence'))
  L.push(t('m3.rec.disclaimer'))

  return L.join('\n')
}

// FR-22: a channel is displayable only with an official source URL + verification date + reviewer role.
export const validChannel = (c) => !!(c && c.name && c.contact && /^https:\/\//.test(c.sourceUrl || '') && c.verifiedOn && c.reviewerRole)

/**
 * Pure JavaScript local PDF document generator
 * Generates valid PDF-1.4 binary Blob offline without external dependencies
 * In browser: uses Canvas rendering for crisp Ethiopic Unicode font fidelity
 * In Node/SSR test: builds structural PDF stream
 */
export function generateReportPdfBlob(draftText, metadata = {}) {
  const title = metadata.title || 'CyberShield Ethiopia Incident Report'
  const text = draftText || ''
  const dateStr = metadata.date || new Date().toISOString().slice(0, 10)

  // Check if browser Canvas is available
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      // A4 Dimensions at 150 DPI: 1240 x 1754
      const pageWidth = 1240
      const pageHeight = 1754
      const marginX = 80
      const marginY = 90
      const lineHeight = 28

      // Wrap lines so content is not truncated
      const rawLines = text.split('\n')
      const lines = []
      for (const rawLine of rawLines) {
        if (rawLine.length > 80 && !rawLine.startsWith('---')) {
          let cur = rawLine
          while (cur.length > 80) {
            let breakIdx = cur.lastIndexOf(' ', 80)
            if (breakIdx === -1 || breakIdx < 30) breakIdx = 80
            lines.push(cur.slice(0, breakIdx))
            cur = '   ' + cur.slice(breakIdx).trimStart()
          }
          if (cur.trim().length > 0) lines.push(cur)
        } else {
          lines.push(rawLine)
        }
      }

      // Chunk lines into pages (max 48 lines per page to accommodate header/footer)
      const linesPerPage = 48
      const pageChunks = []
      for (let i = 0; i < lines.length; i += linesPerPage) {
        pageChunks.push(lines.slice(i, i + linesPerPage))
      }
      if (pageChunks.length === 0) {
        pageChunks.push([])
      }

      const pages = []

      for (let pIdx = 0; pIdx < pageChunks.length; pIdx++) {
        const chunk = pageChunks[pIdx]
        const canvas = document.createElement('canvas')
        canvas.width = pageWidth
        canvas.height = pageHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')

        // Background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, pageWidth, pageHeight)

        // Header Banner
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, pageWidth, 24)

        // Title
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 32px sans-serif'
        ctx.fillText('📋 ' + title, marginX, marginY)

        // Subtitle & Timestamp & Pagination
        ctx.fillStyle = '#64748b'
        ctx.font = '16px monospace'
        const pageLabel = pageChunks.length > 1 ? ` | Page ${pIdx + 1} of ${pageChunks.length}` : ''
        ctx.fillText(`Generated: ${dateStr}${pageLabel} | CyberShield Ethiopia (Offline Memory-Only Draft)`, marginX, marginY + 36)

        // Divider
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(marginX, marginY + 54)
        ctx.lineTo(pageWidth - marginX, marginY + 54)
        ctx.stroke()

        // Body Text
        ctx.fillStyle = '#1e293b'
        ctx.font = '18px monospace'
        let currentY = marginY + 90

        for (const line of chunk) {
          if (line.startsWith('---')) {
            ctx.strokeStyle = '#e2e8f0'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(marginX, currentY - 8)
            ctx.lineTo(pageWidth - marginX, currentY - 8)
            ctx.stroke()
            currentY += 16
            continue
          }

          if (
            line.includes(':') &&
            (line.startsWith('INCIDENT') ||
              line.startsWith('RECOMMENDED') ||
              line.startsWith('CHRONOLOGICAL') ||
              line.startsWith('MADAALLII') ||
              line.startsWith('TARKAANFIIWWAN') ||
              line.startsWith('TARTIIBA') ||
              line.startsWith('የክስተት') ||
              line.startsWith('የሚመከሩ') ||
              line.startsWith('የክስተቶች'))
          ) {
            ctx.fillStyle = '#0f172a'
            ctx.font = 'bold 19px sans-serif'
            ctx.fillText(line, marginX, currentY)
            ctx.font = '18px monospace'
            ctx.fillStyle = '#1e293b'
          } else {
            ctx.fillText(line, marginX, currentY)
          }

          currentY += lineHeight
        }

        // Footer notice
        ctx.fillStyle = '#94a3b8'
        ctx.font = '14px sans-serif'
        ctx.fillText('🔒 Confidential — Generated locally in browser memory. Not transmitted or stored on any server.', marginX, pageHeight - 50)
        if (pageChunks.length > 1) {
          const pStr = `${pIdx + 1} / ${pageChunks.length}`
          ctx.fillText(pStr, pageWidth - marginX - ctx.measureText(pStr).width, pageHeight - 50)
        }

        // Convert canvas image to JPEG data and wrap in PDF
        const dataUrl = canvas.toDataURL('image/jpeg', 0.90)
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
      // Fallback to text PDF stream
    }
  }

  // Fallback structural PDF generator (works in Node.js test environment)
  return createStructuralTextPdf(draftText, metadata)
}

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

    // Page Obj
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

  // XRef Table with exact 20-byte entries per ISO 32000-1 specification
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

export function createPdfWithJpeg(jpegBytes, width, height) {
  return createPdfWithJpegPages([{ width, height, bytes: jpegBytes }])
}

export function createStructuralTextPdf(text, metadata = {}) {
  const title = typeof metadata === 'string' ? metadata : (metadata.title || 'CyberShield Ethiopia Incident Report')
  const dateStr = typeof metadata === 'object' && metadata.date ? metadata.date : new Date().toISOString().slice(0, 10)
  const safeTitle = (title || '').replace(/[\\()]/g, '')
  const rawLines = (text || '').split('\n')

  const safeLines = []
  safeLines.push(safeTitle)
  safeLines.push(`Date: ${dateStr} | CyberShield Ethiopia (Offline Memory-Only Draft)`)
  safeLines.push('--------------------------------------------------')
  for (const line of rawLines) {
    const sanitized = line.replace(/[\\()]/g, '').trimEnd()
    const asciiSafe = sanitized.replace(/[^\x20-\x7E]/g, '?')
    if (asciiSafe.length > 85) {
      safeLines.push(asciiSafe.slice(0, 85))
      safeLines.push('  ' + asciiSafe.slice(85, 170))
    } else {
      safeLines.push(asciiSafe)
    }
  }

  let contentStream = 'BT\r\n/F1 14 Tf\r\n50 780 Td\r\n'
  contentStream += `(${safeLines[0] || 'Incident Report Draft'}) Tj\r\n`
  contentStream += '/F1 10 Tf\r\n0 -20 Td\r\n'
  contentStream += `(${safeLines[1]}) Tj\r\n0 -16 Td\r\n`
  for (let i = 2; i < Math.min(safeLines.length, 52); i++) {
    contentStream += `(${safeLines[i]}) Tj\r\n0 -14 Td\r\n`
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

// Export expanded intelligent M3 incident response, recovery & institutional features
export {
  INCIDENT_CATEGORIES,
  classifyIncidentCategory,
  PLATFORM_RECOVERY_GUIDES,
  getEmergencyContainmentActions,
  RECOVERY_SCAM_FLAGS,
} from './m3Recovery.js'

export {
  OFFICIAL_REPORTING_DIRECTORY,
  filterReportingDirectory,
} from './m3ReportingDirectory.js'

export {
  detectLanguageMix,
  professionalizeIncidentText,
  translateInstitutionalContent,
} from './m3Language.js'

export {
  INSTITUTIONAL_PROFILES,
  REPORT_SECTIONS,
  buildInstitutionalReport,
  auditReportQuality,
} from './m3Institutional.js'

export {
  INCIDENT_ROUTING_PROFILES,
  getRecommendedRouting,
} from './m3IntelligentRouting.js'




