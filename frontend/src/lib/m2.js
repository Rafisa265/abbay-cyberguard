// M2 — all local. Randomness only from crypto.getRandomValues; Math.random is never used.

const COMMON = [
  'password', 'password1', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'welcome123', 'admin', 'admin123', 'admin1234', 'administrator',
  'iloveyou', 'monkey', 'dragon', 'football', 'login', 'passw0rd', '111111', '000000',
  'trustno1', 'sunshine', 'master', 'superman', 'computer', 'shadow', 'secret', 'starwars',
  'ethiopia', 'ethiopia123', 'ethiopia2024', 'ethiopia2025', 'ethiopia2026', 'ethio', 'ethiopian', 'telebirr', 'telebirr123',
  'telecom', 'cbe', 'cbe123', 'cbe1234', 'cbebirr', 'habesha', 'selam', 'selam123',
  'addisababa', 'oromia', 'amhara', 'tigray', 'sidama', 'somali', 'afar', 'harar', 'diredawa', 'buna', 'injera'
]

const WALKS = [
  'qwerty', 'ytrewq', 'asdfgh', 'hgfdsa', 'zxcvbn', 'nbvcxz',
  'qazwsx', '1qaz2wsx', '123456', '654321', 'poiuyt', 'lkjhgf',
  'mnbvcx', '147258', '2580', '123456789', '987654321', '098765'
]

export const hasNonAscii = (s) => /[^\x00-\x7f]/.test(s)

export const CLASSES = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
}

// Visually ambiguous and easily confused characters across fonts and displays
export const AMBIGUOUS_CHARS = '1lI|0Oo8B2Z5S`\'"~;:.,<>()[]{}/\\'

function decodeLeetspeak(s) {
  return s
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/!/g, 'i')
    .replace(/\+/g, 't')
}

function hasSequence(s) {
  const l = s.toLowerCase()
  for (let i = 0; i + 3 < l.length; i++) {
    const [a, b, c, d] = [l.charCodeAt(i), l.charCodeAt(i + 1), l.charCodeAt(i + 2), l.charCodeAt(i + 3)]
    if ((b - a === 1 && c - b === 1 && d - c === 1) || (a - b === 1 && b - c === 1 && c - d === 1)) return true
  }
  return false
}

export function analyze(pw) {
  if (typeof pw !== 'string' || !pw.trim()) return null
  const feedback = []
  const riskFactors = []
  const recommendations = []
  const lower = pw.toLowerCase()

  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[ -/:-@[-`{-~]/.test(pw)) pool += 33
  const nonAscii = hasNonAscii(pw)
  if (nonAscii) pool += 26  // credited conservatively; flagged low-confidence
  let bits = pw.length * Math.log2(Math.max(pool, 2))

  // 1. Common Dictionary & Pattern Match (Direct + Leetspeak + Affixes + Affixed Dates/Numbers)
  const candidates = new Set()
  candidates.add(lower)
  candidates.add(lower.replace(/[^a-z0-9]+$/g, ''))
  candidates.add(lower.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
  candidates.add(lower.replace(/(19\d\d|20\d\d)[^a-z0-9]*$/, '').replace(/[^a-z0-9@$]+$/, ''))
  candidates.add(lower.replace(/(123|1234|2024|2025|2026|2027)[^a-z0-9]*$/, '').replace(/[^a-z0-9@$]+$/, ''))
  candidates.add(lower.replace(/[^a-z0-9]+.*$/, ''))
  candidates.add(lower.replace(/^[0-9]+[^a-z0-9]*/, '').replace(/[^a-z0-9]+.*$/, ''))

  const noTrailingDigits = lower.replace(/[^a-z0-9]+$/g, '').replace(/\d+$/g, '')
  candidates.add(noTrailingDigits)
  candidates.add(noTrailingDigits.replace(/^[^a-z0-9]+/, ''))
  candidates.add(noTrailingDigits.replace(/^[0-9]+/, ''))

  const initialCandidates = [...candidates]
  for (const c of initialCandidates) {
    if (!c) continue
    const dec = decodeLeetspeak(c)
    candidates.add(dec)
    candidates.add(dec.replace(/^[^a-z]+|[^a-z]+$/g, ''))
    candidates.add(dec.replace(/\d+$/g, ''))
  }

  const commonSet = new Set(COMMON)
  let common = false
  for (const term of candidates) {
    if (commonSet.has(term)) {
      common = true
      break
    }
  }

  if (common) {
    feedback.push('common')
    riskFactors.push('common_dictionary')
    recommendations.push('rec_avoid_common')
    bits = Math.min(bits, 10)
  }

  // 2. Predictable Structure (e.g. Single Capital + word + numbers + symbol: Password123!)
  const hasPredictableStructure = /^[A-Z][a-z]{3,15}[\d!@#$%^&*()_\-+=\[\]{}|;:,.<>?/\\~`]{1,8}$/.test(pw)
  if (hasPredictableStructure) {
    if (!feedback.includes('predictable_structure')) feedback.push('predictable_structure')
    riskFactors.push('predictable_structure')
    recommendations.push('rec_avoid_structure')
    bits *= 0.65
  }

  // 3. Repeated Characters & Low Diversity
  const unique = new Set(pw).size
  if (/(.)\1{2,}/.test(pw) || /(.{2,4})\1{2,}/.test(pw)) {
    if (!feedback.includes('repeat')) feedback.push('repeat')
    riskFactors.push('repeated_characters')
    recommendations.push('rec_avoid_repeats')
    bits *= 0.6
  }
  if (unique <= 3 && pw.length >= 6) {
    if (!feedback.includes('repeat')) feedback.push('repeat')
    if (!riskFactors.includes('repeated_characters')) riskFactors.push('repeated_characters')
    if (!recommendations.includes('rec_avoid_repeats')) recommendations.push('rec_avoid_repeats')
    bits = Math.min(bits, 15)
  }

  // 4. Sequences & Keyboard Walks
  if (hasSequence(pw)) {
    feedback.push('sequence')
    riskFactors.push('character_sequence')
    recommendations.push('rec_avoid_sequences')
    bits *= 0.6
  }
  if (WALKS.some((w) => lower.includes(w))) {
    feedback.push('walk')
    riskFactors.push('keyboard_pattern')
    recommendations.push('rec_avoid_walk')
    bits *= 0.6
  }

  // 5. Dates & Years
  if (/(19|20)\d{2}/.test(pw)) {
    feedback.push('date')
    riskFactors.push('contains_date')
    recommendations.push('rec_avoid_dates')
    bits *= 0.85
  }

  // 6. Length & Character Diversity
  if (pw.length < 8) {
    feedback.push('short')
    riskFactors.push('critically_short')
    recommendations.push('rec_length_critical')
    bits = Math.min(bits, 12)
  } else if (pw.length < 12) {
    feedback.push('short')
    riskFactors.push('too_short')
    recommendations.push('rec_length')
    bits = Math.min(bits, 28)
  }

  const classCount = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (classCount < 3) {
    feedback.push('mix')
    riskFactors.push('missing_classes')
    recommendations.push('rec_mix_classes')
  }

  // Determine category strictly: 0 very weak, 1 weak, 2 fair, 3 strong
  let category = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : 3
  if (pw.length < 10) category = Math.min(category, 1)
  else if (pw.length < 12) category = Math.min(category, 2)
  if (common) category = 0
  if (hasPredictableStructure) category = Math.min(category, 1)

  // Accessible score in 0–100 scale aligned with category bounds
  let score = 0
  if (category === 0) score = Math.min(25, Math.max(5, Math.round(bits * 0.9)))
  else if (category === 1) score = Math.min(50, Math.max(26, Math.round(bits * 1.0)))
  else if (category === 2) score = Math.min(75, Math.max(51, Math.round(bits * 1.05)))
  else score = Math.min(100, Math.max(76, Math.round(bits * 1.1)))

  // Application Minimum Password Policy Verification
  // App policy: min 12 chars, max 128 chars, at least 1 letter, at least 1 number
  const policyChecks = {
    minLength: pw.length >= 12,
    maxLength: pw.length <= 128,
    hasLetter: /[a-zA-Z]/.test(pw),
    hasNumber: /\d/.test(pw),
  }
  const meetsAppPolicy = policyChecks.minLength && policyChecks.maxLength && policyChecks.hasLetter && policyChecks.hasNumber

  if (!feedback.length) feedback.push('good')
  if (recommendations.length === 0) recommendations.push('rec_good_practice')

  return {
    category,
    score,
    feedback,
    riskFactors,
    recommendations,
    meetsAppPolicy,
    policyChecks,
    nonAscii,
    bits: Math.round(bits),
    limitations: 'theoretical_entropy_only'
  }
}

// Unbiased integer in [0, n): out-of-range 32-bit draws are discarded (rejection sampling).
export function randomInt(n, rng = crypto) {
  if (!rng || typeof rng.getRandomValues !== 'function') {
    throw new Error('nocrypto')
  }
  const limit = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    rng.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

export function generate(
  {
    length = 16,
    classes = { lower: true, upper: true, digits: true, symbols: true },
    excludeAmbiguous = false,
  } = {},
  rng = crypto
) {
  if (!rng || typeof rng.getRandomValues !== 'function') {
    throw new Error('nocrypto')
  }
  const activeKeys = Object.keys(CLASSES).filter((k) => classes[k])
  if (!activeKeys.length) throw new Error('noclass')
  if (!Number.isInteger(length) || length < 12 || length > 64) throw new Error('length')

  const sets = activeKeys.map((k) => {
    let charset = CLASSES[k]
    if (excludeAmbiguous) {
      const filtered = [...charset].filter((ch) => !AMBIGUOUS_CHARS.includes(ch)).join('')
      if (filtered.length > 0) return filtered
    }
    return charset
  })

  const all = sets.join('')
  if (!all.length) throw new Error('noclass')

  // Guaranteed inclusion: at least one character from each active character set
  const out = sets.map((s) => s[randomInt(s.length, rng)])
  while (out.length < length) {
    out.push(all[randomInt(all.length, rng)])
  }

  // Fisher-Yates uniform shuffle using unbiased CSPRNG draws
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}
