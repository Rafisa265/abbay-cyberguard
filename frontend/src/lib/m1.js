// M1 — URL-text heuristics. Never fetches, resolves or opens the URL (FR-05).
import m1Weights from './m1ModelWeights.js'

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'cutt.ly', 'rebrand.ly']
const WORDS = ['login', 'verify', 'account', 'update', 'password', 'bank', 'signin', 'secure']
export const WEIGHTS = { 'IND-01': 30, 'IND-02': 25, 'IND-03': 25, 'IND-04': 10, 'IND-05': 10, 'IND-06': 15, 'IND-07': 10, 'IND-08': 5, 'IND-09': 10, 'IND-10': 10 }

export function normalize(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { error: 'empty' }
  if (s.length > 2048) return { error: 'toolong' }
  let text = s, defaulted = false
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^(javascript|data|file|vbscript|blob|about|mailto|tel|ftp):/i.test(s)) return { error: 'scheme' }
    text = 'https://' + s; defaulted = true  // documented default, shown to the user
  }
  let u
  try { u = new URL(text) } catch { return { error: 'parse' } }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'scheme' }
  if (!u.hostname) return { error: 'parse' }
  return { url: u, text, defaulted }
}

export function isDocumentationHost(host) {
  if (!host) return false
  const h = String(host).toLowerCase().replace(/^www\./, '')
  // RFC 5737 IPv4 documentation blocks (TEST-NET-1, TEST-NET-2, TEST-NET-3)
  if (/^192\.0\.2\.\d{1,3}$/.test(h)) return true
  if (/^198\.51\.100\.\d{1,3}$/.test(h)) return true
  if (/^203\.0\.113\.\d{1,3}$/.test(h)) return true
  // RFC 3849 IPv6 documentation prefix (2001:db8::/32)
  if (h.startsWith('[2001:db8:') || h === '[2001:db8::]') return true
  // RFC 2606 & RFC 6761 reserved documentation and test domains (.example, .test, .invalid, .localhost)
  if (/\.(example|test|invalid|localhost)$/i.test(h) || /^(example|test|invalid|localhost)$/i.test(h)) return true
  return false
}

export function computeShannonEntropy(text) {
  if (!text) return 0.0
  const len = text.length
  const freq = {}
  for (let i = 0; i < len; i++) {
    const ch = text[i]
    freq[ch] = (freq[ch] || 0) + 1
  }
  let ent = 0.0
  for (const count of Object.values(freq)) {
    const p = count / len
    ent -= p * Math.log2(p)
  }
  return ent
}

export function isIpAddressHost(host) {
  if (!host) return false
  const clean = host.replace(/^\[|\]$/g, '').trim()
  if (!clean) return false
  const parts = clean.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p) && +p >= 0 && +p <= 255)) {
    return true
  }
  if (clean.includes(':') && /^[0-9a-fA-F:]+$/.test(clean)) {
    return true
  }
  return false
}

export const SUSPICIOUS_URL_KEYWORDS = [
  'login', 'verify', 'account', 'update', 'password', 'bank',
  'signin', 'secure', 'token', 'cbe', 'telecom', 'auth', 'support', 'wallet',
]

export function extractUrlFeatures(rawUrl) {
  const s = String(rawUrl ?? '').trim()
  if (!s) return new Array(12).fill(0.0)
  const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s
  let u
  try {
    u = new URL(full)
  } catch {
    return new Array(12).fill(0.0)
  }
  const host = (u.hostname || '').toLowerCase()
  if (!host) return new Array(12).fill(0.0)
  const path = u.pathname || '/'
  const queryLen = u.search ? Math.max(0, u.search.length - 1) : 0
  const pathLen = path.length + queryLen
  const fullLower = full.toLowerCase()

  const fullLen = full.length
  const hostLen = host.length

  const dots = (host.match(/\./g) || []).length
  const subdomainCount = Math.max(0, dots - 1)
  const hyphens = (fullLower.match(/-/g) || []).length
  const digits = (fullLower.match(/\d/g) || []).length
  const digitRatio = digits / Math.max(1, fullLen)

  const hasIp = isIpAddressHost(host) ? 1.0 : 0.0
  const hasAt = full.includes('@') ? 1.0 : 0.0
  const isHttps = u.protocol === 'https:' ? 1.0 : 0.0
  const hasKw = SUSPICIOUS_URL_KEYWORDS.some((kw) => fullLower.includes(kw)) ? 1.0 : 0.0
  const entropy = hostLen > 0 ? computeShannonEntropy(host) : 0.0

  return [
    Math.round(Math.min(1.0, fullLen / 150.0) * 10000) / 10000,
    Math.round(Math.min(1.0, hostLen / 50.0) * 10000) / 10000,
    Math.round(Math.min(1.0, pathLen / 100.0) * 10000) / 10000,
    Math.round(Math.min(1.0, subdomainCount / 4.0) * 10000) / 10000,
    Math.round(Math.min(1.0, dots / 6.0) * 10000) / 10000,
    Math.round(Math.min(1.0, hyphens / 5.0) * 10000) / 10000,
    Math.round(Math.min(1.0, digitRatio * 3.0) * 10000) / 10000,
    hasIp,
    hasAt,
    isHttps,
    hasKw,
    Math.round(Math.min(1.0, entropy / 4.5) * 10000) / 10000,
  ]
}

export function predictUrlLexical(rawUrl) {
  const vec = extractUrlFeatures(rawUrl)
  const logits = m1Weights.WEIGHTS.map((wRow, classIdx) => {
    let dot = m1Weights.BIASES[classIdx]
    for (let i = 0; i < vec.length; i++) {
      dot += wRow[i] * vec[i]
    }
    return dot
  })
  const maxL = Math.max(...logits)
  const exp = logits.map((z) => Math.exp(z - maxL))
  const sumExp = exp.reduce((a, b) => a + b, 0)
  const probs = exp.map((v) => v / sumExp)
  const phishingProb = probs[1]
  const predictedIdx = phishingProb >= 0.5 ? 1 : 0
  const predictedClass = m1Weights.CLASSES[predictedIdx]
  const confidence = probs[predictedIdx]

  // Model outputs an uncalibrated softmax lexical risk score based on 12 URL features.
  // Confidence is not statistically calibrated across real-world traffic distributions.
  const modelRiskScore = Math.round(phishingProb * 10000) / 10000
  const rawConfidence = Math.round(confidence * 10000) / 10000

  return {
    engine: 'ml_url_lexical_v1',
    predictedClass,
    modelRiskScore,
    phishingProbability: modelRiskScore, // Maintained for backward compatibility, represents uncalibrated risk score
    confidence: rawConfidence,
    confidenceCalibrated: false,
    confidenceLabel: 'uncalibrated',
    probabilities: {
      legitimate: Math.round(probs[0] * 10000) / 10000,
      phishing: modelRiskScore,
    },
    features: vec,
    featureNames: m1Weights.FEATURE_NAMES,
    provenance: m1Weights.DATASET_PROVENANCE,
    evaluation: m1Weights.EVALUATION_METRICS,
  }
}

export function analyze(raw) {
  const n = normalize(raw)
  if (n.error) return { error: n.error }
  const { url: u, text, defaulted } = n
  const host = u.hostname.toLowerCase()
  const found = []
  const hit = (id, ok) => ok && !found.includes(id) && found.push(id)
  hit('IND-01', /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('['))
  hit('IND-02', u.username !== '' || u.password !== '')
  hit('IND-03', host.split('.').some((l) => l.startsWith('xn--')))
  hit('IND-04', host.split('.').length >= 5)
  hit('IND-05', u.protocol === 'http:')
  hit('IND-06', SHORTENERS.includes(host.replace(/^www\./, '')))
  hit('IND-07', WORDS.some((w) => (host + decodeURIComponent_safe(u.pathname)).toLowerCase().includes(w)))
  hit('IND-08', text.length > 100)
  hit('IND-09', (text.match(/%[0-9a-f]{2}/gi) || []).length >= 5 || /^[a-z]+:\/\/[^/]*%/i.test(text))
  hit('IND-10', u.port !== '')
  const score = Math.min(100, Math.max(0, found.reduce((a, id) => a + (WEIGHTS[id] || 0), 0)))
  const ml = predictUrlLexical(text)
  return {
    indicators: found,
    score,
    level: levelOf(score),
    defaulted,
    host,
    text,
    isDocAddress: isDocumentationHost(host),
    ml,
  }
}

export const TXT_WEIGHTS = {
  'TXT-01': 40, // Request for passwords, PINs, OTPs, or recovery codes (critical credential risk)
  'TXT-02': 25, // Artificial urgency, threat of suspension or immediate deactivation
  'TXT-03': 20, // Impersonation of banks, telecom, government, or trusted bodies
  'TXT-04': 25, // Financial lure, unexpected prizes, fake lottery, or scholarships
  'TXT-05': 25, // Upfront fee demands, advance payments, or money transfer requests
  'TXT-06': 20, // Suspicious embedded links (shorteners, raw IPs, suspicious terms)
  'TXT-07': 15, // Channel shifting to Telegram/WhatsApp or untrusted APK downloads
  'TXT-08': 20, // Free webmail address claiming official institution identity (email mode)
  'TXT-09': 30, // Request for bank name, bank-account number, or financial account details
  'TXT-10': 20, // Request for personal identity details (name, age, gender, occupation, ID number)
}

export function extractUrls(text) {
  if (typeof text !== 'string' || !text.trim()) return []

  const cleanList = []
  const seen = new Set()

  const pushIfValid = (raw) => {
    // Strip trailing punctuation often attached in natural text
    const u = raw.replace(/[.,;:!?)\]'">]+$/, '')
    if (!u) return
    const lower = u.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      cleanList.push(u)
    }
  }

  // Step 1: Extract URLs with explicit schemes (http://, https://) or starting with www.
  // This captures full links, including basic authentication (e.g., https://user:pass@evil.com)
  const explicitSchemeRegex = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`]+/gi
  let match
  while ((match = explicitSchemeRegex.exec(text)) !== null) {
    pushIfValid(match[0])
    if (cleanList.length >= 10) return cleanList
  }

  // Step 2: Mask explicit scheme URLs AND email addresses so their sub-parts
  // (e.g. example.com inside https://example.com, or gmail.com inside user@gmail.com)
  // are not mistakenly extracted again by schemeless matching.
  const emailRegex = /(?:mailto:)?[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
  const textWithoutExtracted = text
    .replace(explicitSchemeRegex, (m) => ' '.repeat(m.length))
    .replace(emailRegex, (m) => ' '.repeat(m.length))

  // Step 3: Extract schemeless URLs (e.g. raw IPv4 addresses or domains with recognized TLDs)
  const schemelessRegex = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s<>"'{}|\\^`]*)?|\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|et|info|biz|io|co|me|ly|test|invalid|localhost)(?::\d+)?(?:\/[^\s<>"'{}|\\^`]*)?/gi
  while ((match = schemelessRegex.exec(textWithoutExtracted)) !== null) {
    pushIfValid(match[0])
    if (cleanList.length >= 10) return cleanList
  }

  return cleanList
}

export function analyzeText(rawText, mode = 'message') {
  const text = String(rawText ?? '').trim()
  if (!text) return { error: 'empty' }
  if (text.length > 4096) return { error: 'toolong' }

  const lower = text.toLowerCase()
  // Replace Ethiopic and standard punctuation with whitespace to isolate tokens cleanly
  // Ethiopic punctuation: ፡ (wordspace), ። (full stop), ፣ (comma), ፤ (semicolon), ፥ (colon), ፦ (preface colon), ፧ (question mark), ፨ (paragraph)
  const cleanPunct = lower.replace(/[\u1361-\u1368:;,\.!?\-\—\/\\()\[\]{}'"`~«»]/g, ' ')
  const normalized = cleanPunct.replace(/\s+/g, ' ').trim()

  const found = []
  const hit = (id, ok) => ok && !found.includes(id) && found.push(id)

  // 1. TXT-01: Requests for Secrets, Passwords, PINs, OTPs, Recovery Codes
  const secretKeywords = [
    'password', 'passcode', 'pin', 'otp', 'one-time password', 'verification code', 'secret code',
    'recovery code', 'security code', 'cvv', 'cvc', 'credentials',
    'የይለፍ ቃል', 'ኦቲፒ', 'ሚስጥር ቁጥር', 'ማረጋገጫ ኮድ', 'ፒን', 'የይለፍ ቃሎች', 'ኮድ ላክ', 'ኮዱን ይላኩ', 'ኮዱን ንገረኝ',
    'jecha icciitii', 'koodii mirkaneessaa', 'lakkoofsa icciitii', 'pin koodii', 'koodii eeggumsaa'
  ]
  hit('TXT-01', secretKeywords.some((w) => lower.includes(w) || normalized.includes(w)))

  // 2. TXT-02: Urgency, Account Suspension, Threat of Deactivation
  const urgencyKeywords = [
    'urgent', 'immediately', 'within 24 hours', 'within 12 hours', 'account suspended',
    'account blocked', 'deactivated', 'will be closed', 'final warning', 'final notice',
    'act now', 'action required immediately', 'suspended immediately', 'terminated',
    'አስቸኳይ', 'ወዲያውኑ', 'በ24 ሰዓት', 'በ12 ሰዓት', 'ይዘጋል', 'ይታገዳል', 'የመጨረሻ ማስጠንቀቂያ', 'እርምጃ ይወሰዳል', 'አካውንትዎ ታግዷል', 'አካውንትዎ ይዘጋል',
    'ariifachiisaa', 'battalatti', 'sa\'aatii 24 keessatti', 'sa\'aatii 12 keessatti', 'ni cufama', 'ni dhorkama', 'akeekkachiisa dhumaa', 'herregni keessan ni cufama'
  ]
  hit('TXT-02', urgencyKeywords.some((w) => lower.includes(w) || normalized.includes(w)))

  // 3. TXT-03: Organization Impersonation (Banks, Telecom, Official Bodies)
  // Contextual check: Prevent false positives when an institution is merely mentioned in ordinary conversation.
  const orgNames = [
    'commercial bank of ethiopia', 'cbe', 'telebirr', 'ethio telecom', 'ethiotelecom',
    'dashen bank', 'awash bank', 'bank of abyssinia', 'national bank of ethiopia',
    'ethiopian airlines', 'revenue authority', 'ministry of innovation',
    'የኢትዮጵያ ንግድ ባንክ', 'ንግድ ባንክ', 'ቴሌብር', 'ኢትዮ ቴሌኮም', 'ቴሌኮም', 'ዳሸን ባንክ', 'አዋሽ ባንክ', 'ብሔራዊ ባንክ',
    'baankii daldala itoophiyaa', 'telebirr', 'itoo teelekoom', 'baankii daashan', 'baankii awaash'
  ]
  const orgClaimPhrases = [
    'dear customer', 'official notice', 'customer service', 'support team', 'security department',
    'from commercial bank', 'cbe notice', 'telebirr alert', 'notification from',
    'ውድ ደንበኛ', 'ውድ ደንበኛችን', 'ይፋዊ ማስታወቂያ', 'የደህንነት መልእክት', 'ከኢትዮጵያ ንግድ ባንክ', 'ከንግድ ባንክ', 'ከቴሌብር', 'ከኢትዮ ቴሌኮም', 'የደንበኞች አገልግሎት',
    'kabajamoo maamila', 'kabajamoo maamila keenya', 'akeekkachiisa seeraa', 'ergaa nageenyaa', 'baankii daldala itoophiyaa irraa', 'telebirr irraa', 'tajaajila maamiltootaa'
  ]
  const actionPrompts = [
    'verify your account', 'update your account', 'confirm your details', 'verify identity',
    'አካውንትዎን ያረጋግጡ', 'መረጃዎን ያረጋግጡ', 'አረጋግጡ',
    'herrega keessan mirkaneessaa', 'ragaa keessan mirkaneessaa'
  ]
  const mentionsOrg = orgNames.some((w) => lower.includes(w) || normalized.includes(w))
  const claimsOfficial = orgClaimPhrases.some((p) => lower.includes(p) || normalized.includes(p))
  const hasActionPrompt = actionPrompts.some((a) => lower.includes(a) || normalized.includes(a))
  // Impersonation triggers if there is an official claim, or if the org is mentioned alongside an actionable request/urgency
  hit('TXT-03', mentionsOrg && (claimsOfficial || hasActionPrompt || urgencyKeywords.some((w) => lower.includes(w))))

  // 4. TXT-04: Financial Lures, Fake Prizes, Scholarships, Lotteries
  const hasAmharicPrize =
    normalized.includes('እንኳን ደስ አለዎት') ||
    normalized.includes('አሸንፈዋል') ||
    normalized.includes('ተሸላሚ') ||
    normalized.includes('ዕጣዎ ወጥቷል') ||
    normalized.includes('ሽልማትዎን ይውሰዱ') ||
    normalized.includes('ሎተሪ') ||
    (normalized.includes('ሽልማት') && (normalized.includes('ብር') || normalized.includes('የገንዘብ') || normalized.includes('ነፃ') || normalized.includes('ዕጣ') || normalized.includes('ይስጡኝ') || normalized.includes('አሸናፊ') || /\d+\s*ብር/.test(normalized)))

  const hasOromoPrize =
    normalized.includes('baga gammaddan') ||
    normalized.includes('mo\'attaniittu') ||
    normalized.includes('badhaasa keessan fudhadhaa') ||
    normalized.includes('lotarii') ||
    (normalized.includes('badhaasa') && (normalized.includes('qarshii') || normalized.includes('bilisaa') || normalized.includes('mo\'ataniiru') || /\d+\s*qarshii/.test(normalized)))

  const hasEnglishPrize =
    normalized.includes('congratulations') ||
    normalized.includes('you have won') ||
    normalized.includes('you won') ||
    normalized.includes('prize winner') ||
    normalized.includes('cash prize') ||
    normalized.includes('selected for scholarship') ||
    normalized.includes('grant approved') ||
    normalized.includes('lottery winner') ||
    normalized.includes('claim prize') ||
    normalized.includes('claim reward') ||
    (normalized.includes('prize') && (normalized.includes('birr') || normalized.includes('cash') || normalized.includes('won') || normalized.includes('claim') || normalized.includes('free') || /\$\d+|\d+\s*birr/.test(normalized)))

  hit('TXT-04', Boolean(hasAmharicPrize || hasOromoPrize || hasEnglishPrize))

  // 5. TXT-05: Upfront Payment, Fee Demands, Unsolicited Transfers
  const paymentKeywords = [
    'processing fee', 'delivery fee', 'registration fee', 'clearance fee', 'pay upfront',
    'send money first', 'transfer fee', 'deposit required', 'claim fee',
    'የአገልግሎት ክፍያ', 'ቅድመ ክፍያ', 'ገንዘብ ያስተላልፉ', 'የመመዝገቢያ ክፍያ', 'የማስለቀቂያ ክፍያ', 'ክፍያ ይፈጽሙ',
    'kaffaltii tajaajilaa', 'dursa kaffalaa', 'qarshii daddabarsaa', 'kaffaltii galmee', 'kaffaltii duraa'
  ]
  hit('TXT-05', paymentKeywords.some((w) => lower.includes(w) || normalized.includes(w)))

  // Extract candidate URLs embedded in the text
  const extractedList = extractUrls(text)
  const urlAnalyses = extractedList.map((rawU) => ({
    rawUrl: rawU,
    analysis: analyze(rawU)
  }))

  // 6. TXT-06: Suspicious Embedded URLs
  const hasSuspiciousUrl = urlAnalyses.some(
    (ua) => ua.analysis && !ua.analysis.error && (ua.analysis.score >= 25 || ua.analysis.indicators?.includes('IND-01') || ua.analysis.indicators?.includes('IND-06') || ua.analysis.isDocAddress)
  )
  hit('TXT-06', extractedList.length > 0 && hasSuspiciousUrl)

  // 7. TXT-07: Channel Shifting & APK / Software Download Demands
  const channelApkKeywords = [
    'download apk', 'install apk', 'download app', 'telegram bot', 't.me/',
    'whatsapp.com', 'contact on whatsapp', 'dm on telegram', 'inbox on telegram', 'install this file',
    'apk አውርድ', 'መተግበሪያውን ጫን', 'ቴሌግራም ቦት', 'በዋትስአፕ አግኙኝ', 'ፋይሉን ጫን', 'መተግበሪያ አውርድ',
    'apk buufadhaa', 'app fe\'aa', 'telegram bot', 'whatsapp irratti nu qunnamaa', 'faayilii kana fe\'aa'
  ]
  hit('TXT-07', channelApkKeywords.some((w) => lower.includes(w) || normalized.includes(w)))

  // 8. TXT-08: Suspicious Email Sender / Mismatches (Email Mode only)
  if (mode === 'email') {
    const freeWebmailDomains = ['@gmail.com', '@yahoo.com', '@hotmail.com', '@outlook.com', '@mail.com']
    const hasOfficialClaim = orgNames.some((w) => lower.includes(w))
    const hasFreeWebmail = freeWebmailDomains.some((d) => lower.includes(d))
    hit('TXT-08', hasOfficialClaim && hasFreeWebmail)
  }

  // 9. TXT-09: Request for Bank Name, Account Number, or Financial Account Details
  const bankAccountKeywords = [
    // Amharic bank details requests
    'የባንክ ስም', 'የአካውንት ቁጥር', 'አካውንት ቁጥር', 'የባንክ አካውንት', 'የሂሳብ ቁጥር', 'የባንክ ሂሳብ',
    'የካርድ ቁጥር', 'የባንክ መረጃ', 'የባንክዎን ስም', 'የሂሳብ ቁጥርዎን', 'አካውንትዎን ይላኩ', 'የባንክ አካውንትዎን',
    // Afaan Oromoo bank details requests
    'lakkoofsa herregaa', 'maqaa baankii', 'herrega baankii', 'lakkoofsa kaardii', 'odeeffannoo baankii',
    'herrega keessan ergaa', 'lakkoofsa herrega baankii',
    // English bank details requests
    'account number', 'bank name', 'bank account', 'banking details', 'account details',
    'card number', 'credit card number', 'debit card number', 'routing number', 'iban',
    'send your account', 'provide your bank'
  ]
  hit('TXT-09', bankAccountKeywords.some((w) => lower.includes(w) || normalized.includes(w)))

  // 10. TXT-10: Request for Personal Identity & Profiling Details (Name, Age, Gender, Occupation, ID number)
  // Check for explicit personal profiling requests or multiple demographic/identity attribute prompts
  const explicitPersonalPhrases = [
    'የግል መረጃ', 'የሚከተሉትን መረጃዎች', 'መረጃዎን ይስጡ', 'መረጃዎችን ይስጡ', 'የግል ዝርዝር',
    'ragaa dhuunfaa', 'odeeffannoo dhuunfaa', 'ragaa armaan gadii', 'odeeffannoo keessan guutaa',
    'personal information', 'personal details', 'provide your details', 'fill the following', 'submit your details', 'provide the following details'
  ]
  const hasExplicitPersonal = explicitPersonalPhrases.some((p) => lower.includes(p) || normalized.includes(p))

  // Amharic attribute tokens
  const hasAmName = /(?:^|\s)(?:ስም|ሙሉ ስም)(?:\s|$)/.test(normalized) || normalized.includes('ስም ')
  const hasAmAge = /(?:^|\s)ዕድሜ(?:\s|$)/.test(normalized)
  const hasAmGender = /(?:^|\s)ፆታ(?:\s|$)/.test(normalized)
  const hasAmWork = /(?:^|\s)ሥራ(?:\s|$)/.test(normalized) || /(?:^|\s)ስራ(?:\s|$)/.test(normalized)
  const hasAmId = normalized.includes('መታወቂያ') || normalized.includes('ፋይዳ')
  const hasAmDob = normalized.includes('የትውልድ ቀን')
  const amAttrCount = [hasAmName, hasAmAge, hasAmGender, hasAmWork, hasAmId, hasAmDob].filter(Boolean).length

  // Afaan Oromoo attribute tokens
  const hasOmName = /(?:^|\s)(?:maqaa|maqaa guutuu)(?:\s|$)/.test(normalized)
  const hasOmAge = /(?:^|\s)umrii(?:\s|$)/.test(normalized)
  const hasOmGender = /(?:^|\s)saala(?:\s|$)/.test(normalized)
  const hasOmWork = /(?:^|\s)hojii(?:\s|$)/.test(normalized)
  const hasOmId = normalized.includes('waraqaa eenyummaa')
  const omAttrCount = [hasOmName, hasOmAge, hasOmGender, hasOmWork, hasOmId].filter(Boolean).length

  // English attribute tokens
  const hasEnName = /(?:^|\s)(?:full name|name)(?:\s|$)/.test(normalized)
  const hasEnAge = /(?:^|\s)age(?:\s|$)/.test(normalized)
  const hasEnGender = /(?:^|\s)gender(?:\s|$)/.test(normalized)
  const hasEnWork = /(?:^|\s)(?:occupation|job title)(?:\s|$)/.test(normalized)
  const hasEnId = normalized.includes('id number') || normalized.includes('national id')
  const enAttrCount = [hasEnName, hasEnAge, hasEnGender, hasEnWork, hasEnId].filter(Boolean).length

  const hasMultipleIdentityAttributes = amAttrCount >= 2 || omAttrCount >= 2 || enAttrCount >= 2
  hit('TXT-10', Boolean(hasExplicitPersonal || hasMultipleIdentityAttributes))

  const score = Math.min(100, found.reduce((acc, id) => acc + (TXT_WEIGHTS[id] || 15), 0))
  const level = levelOf(score)

  return {
    mode,
    text,
    indicators: found,
    score,
    level,
    extractedUrls: urlAnalyses,
  }
}

function decodeURIComponent_safe(s) { try { return decodeURIComponent(s) } catch { return s } }
export const levelOf = (score) => (score === 0 ? 'none' : score < 40 ? 'caution' : 'high')
