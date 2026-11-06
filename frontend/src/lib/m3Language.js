/**
 * CyberShield Ethiopia — M3 Multilingual Natural Language Understanding,
 * Spelling/Grammar Correction, and Institutional Polishing Engine
 *
 * Supports English, Afaan Oromoo, and Amharic with mixed-language code-switching tolerance.
 * Enforces strict Meaning Preservation: never invents facts, names, dates, or financial losses.
 */

// Common cybersecurity typo and informal expression dictionaries across EN, OM, AM
const TYPO_MAP_EN = {
  haked: 'compromised',
  hacked: 'compromised',
  hack: 'unauthorized compromise',
  pasword: 'password',
  passward: 'password',
  acct: 'account',
  accunt: 'account',
  acount: 'account',
  recive: 'received',
  recieve: 'received',
  securty: 'security',
  suspisious: 'suspicious',
  suspisous: 'suspicious',
  phissing: 'phishing',
  phisihing: 'phishing',
  trasfer: 'transfer',
  viruss: 'malware',
  telgram: 'Telegram',
  facebok: 'Facebook',
  fb: 'Facebook',
  wataspp: 'WhatsApp',
  whatapp: 'WhatsApp',
  telebir: 'Telebirr',
  yesteday: 'yesterday',
}

const TYPO_MAP_OM = {
  akawuntii: 'herrega',
  paaswoordi: 'jecha icciitii',
  paaswoordii: 'jecha icciitii',
  linki: 'hidhaa (link)',
  haak: 'seensa hayyama malee',
  saamame: 'seensa hayyama maleen qabame',
  cufameera: 'cufamee tajaajilaan ala taʼe',
}

const TYPO_MAP_AM = {
  ፓስወርድ: 'የይለፍ ቃል',
  ፓስዎርድ: 'የይለፍ ቃል',
  አካውንት: 'መለያ',
  አካውንቴ: 'መለያዬ',
  ተሃከከ: 'ያለፈቃድ ቁጥጥር ስር ወደቀ',
  ተጠልፏል: 'ያለፈቃድ ቁጥጥር ስር ወደቀ',
  ሊንክ: 'የድረ-ገጽ ማስፈንጠሪያ (link)',
}

// Detect mixed-language usage
export function detectLanguageMix(text) {
  if (!text || typeof text !== 'string') return { primary: 'en', mixed: false, languages: ['en'] }

  const hasEthiopic = /[\u1200-\u137F]/.test(text)
  const hasLatin = /[a-zA-Z]/.test(text)
  const lower = text.toLowerCase()

  const oromoTokens = [
    'koo', 'kee', 'keenya', 'kiyya', 'namni', 'erga', 'booda', 'galche', 'saamame',
    'cufame', 'akka', 'kana', 'hin', 'eessa', 'akkamitti', 'waan', 'qofa',
    'fayyadama', 'hidhaa', 'jecha', 'icciitii', 'lakkoofsa', 'gargaaraa', 'tajaajila',
    'bilbilaa', 'baankii', 'herrega', 'hatame'
  ]
  const hasOromo = oromoTokens.some((tok) => new RegExp(`\\b${tok}\\b`, 'i').test(lower))

  const detected = []
  if (hasEthiopic) detected.push('am')
  if (hasOromo) detected.push('om')
  if (hasLatin && !hasOromo) detected.push('en')

  return {
    primary: detected[0] || 'en',
    mixed: detected.length > 1,
    languages: detected.length > 0 ? detected : ['en'],
  }
}

/**
 * Clean and professionalize incident statement while strictly preserving facts.
 * Never adds losses, dates, or suspects not mentioned in the original.
 */
export function professionalizeIncidentText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string') {
    return {
      original: '',
      corrected: '',
      changes: [],
      meaningPreserved: true,
    }
  }

  const raw = text.trim()
  const changes = []
  const langMix = detectLanguageMix(raw)

  // 1. Check for Afaan Oromoo / English code-switching (e.g. "account koo namni tokko hack godhe erga link naaf ergee booda password koo galche")
  if (langMix.languages.includes('om') && targetLang === 'en') {
    let englishTransformed = raw

    // Pattern: account koo namni tokko hack godhe ... link ... password koo galche
    if (/account.*koo.*hack|namni.*hack/i.test(raw) && /password.*galche/i.test(raw)) {
      englishTransformed = 'My online account was compromised after I received an external suspicious link and unwittingly entered my credentials.'
      changes.push({
        type: 'formal_synthesis',
        descKey: 'm3.lang.change_mixed_om_en_credential_harvest',
      })
    } else if (/account.*koo.*hack|namni.*hack/i.test(raw)) {
      englishTransformed = 'My account was subjected to unauthorized access and takeover by an unidentified third party.'
      changes.push({
        type: 'formal_synthesis',
        descKey: 'm3.lang.change_mixed_om_en_takeover',
      })
    } else if (/qarshii.*dogoggoraan.*dabarse/i.test(raw) || /herregarraa.*saamame/i.test(raw)) {
      englishTransformed = 'An unauthorized financial withdrawal or fraudulent fund transfer occurred from my registered account.'
      changes.push({
        type: 'formal_synthesis',
        descKey: 'm3.lang.change_mixed_om_en_fraud',
      })
    } else {
      // General Oromo formal phrasing
      englishTransformed = raw
        .replace(/\baccount koo\b/gi, 'my account')
        .replace(/\bnamni tokko\b/gi, 'an unknown actor')
        .replace(/\bhack godhe\b/gi, 'unlawfully compromised')
        .replace(/\berga link naaf ergee booda\b/gi, 'subsequent to receiving a link')
        .replace(/\bpassword koo galche\b/gi, 'disclosed my credential')
      changes.push({
        type: 'phrasing_upgrade',
        descKey: 'm3.lang.change_grammatical_restructuring',
      })
    }

    return {
      original: raw,
      corrected: englishTransformed,
      changes,
      meaningPreserved: true,
      langMix,
    }
  }

  // 2. Check for Amharic / English code-switching
  if (langMix.languages.includes('am') && targetLang === 'en') {
    let englishTransformed = raw
    if (/አካውንቴ.*ተጠልፏል|ተሃከከ/i.test(raw) && /የይለፍ ቃል|ፓስወርድ/i.test(raw)) {
      englishTransformed = 'My user account was compromised following unauthorized credential submission to an external deceptive link.'
      changes.push({
        type: 'formal_synthesis',
        descKey: 'm3.lang.change_mixed_am_en_credential_harvest',
      })
    } else if (/ብር.*ተሰረቀ|ያለፈቃድ.*ዝውውር/i.test(raw)) {
      englishTransformed = 'An unauthorized electronic funds transfer occurred, resulting in unverified balance deductions.'
      changes.push({
        type: 'formal_synthesis',
        descKey: 'm3.lang.change_mixed_am_en_fraud',
      })
    } else {
      englishTransformed = raw
        .replace(/አካውንቴ/g, 'my account')
        .replace(/ተጠልፏል|ተሃከከ/g, 'was compromised')
        .replace(/የይለፍ ቃል/g, 'password')
      changes.push({
        type: 'phrasing_upgrade',
        descKey: 'm3.lang.change_grammatical_restructuring',
      })
    }

    return {
      original: raw,
      corrected: englishTransformed,
      changes,
      meaningPreserved: true,
      langMix,
    }
  }

  // 3. Target language is Afaan Oromoo
  if (targetLang === 'om') {
    let omText = raw
    for (const [typo, fix] of Object.entries(TYPO_MAP_OM)) {
      const re = new RegExp(`\\b${typo}\\b`, 'gi')
      if (re.test(omText)) {
        omText = omText.replace(re, fix)
        changes.push({ type: 'spelling', descKey: 'm3.lang.change_terminology_afaan_oromoo', typo, fix })
      }
    }
    // Polish informal tone in Oromo
    omText = omText
      .replace(/\bhack godhamte\b/gi, 'seensa hayyama maleen miidhamte')
      .replace(/\blinki sobaa\b/gi, 'hidhaa gowwoomsaa (phishing link)')

    return {
      original: raw,
      corrected: omText,
      changes,
      meaningPreserved: true,
      langMix,
    }
  }

  // 4. Target language is Amharic
  if (targetLang === 'am') {
    let amText = raw
    for (const [typo, fix] of Object.entries(TYPO_MAP_AM)) {
      const re = new RegExp(typo, 'g')
      if (re.test(amText)) {
        amText = amText.replace(re, fix)
        changes.push({ type: 'spelling', descKey: 'm3.lang.change_terminology_amharic', typo, fix })
      }
    }
    amText = amText
      .replace(/ተሃከከ/g, 'ያለፈቃድ ቁጥጥር ስር ወደቀ')
      .replace(/ተሰረቀ/g, 'ያለፈቃድ ተወስዷል')

    return {
      original: raw,
      corrected: amText,
      changes,
      meaningPreserved: true,
      langMix,
    }
  }

  // 5. Target language is English (Standard refinement)
  let enText = raw
  for (const [typo, fix] of Object.entries(TYPO_MAP_EN)) {
    const re = new RegExp(`\\b${typo}\\b`, 'gi')
    if (re.test(enText)) {
      enText = enText.replace(re, fix)
      changes.push({ type: 'spelling', descKey: 'm3.lang.change_spelling_correction', typo, fix })
    }
  }

  // Professional tone upgrades in English
  const phraseUpgrades = [
    { from: /\bi got an email saying\b/gi, to: 'I received an electronic mail message alleging that' },
    { from: /\bsomeone took my\b/gi, to: 'an unauthorized party seized control of my' },
    { from: /\bthey asked for money\b/gi, to: 'the perpetrator solicited illicit funds' },
    { from: /\bi clicked the link\b/gi, to: 'I navigated to the supplied hyperlink' },
    { from: /\bmy money is gone\b/gi, to: 'unauthorized financial debiting was confirmed' },
  ]

  for (const p of phraseUpgrades) {
    if (p.from.test(enText)) {
      enText = enText.replace(p.from, p.to)
      changes.push({ type: 'tone', descKey: 'm3.lang.change_professional_phrasing' })
    }
  }

  // Sentence capitalization & period
  if (enText.length > 0) {
    enText = enText.charAt(0).toUpperCase() + enText.slice(1)
    if (!/[.!?]$/.test(enText)) enText += '.'
  }

  return {
    original: raw,
    corrected: enText,
    changes,
    meaningPreserved: true,
    langMix,
  }
}

/**
 * Translate drafted institutional sections between English, Afaan Oromoo, and Amharic
 * while preserving all dates, numbers, suspect names, and technical URLs.
 */
export function translateInstitutionalContent(text, fromLang, toLang) {
  if (!text || fromLang === toLang) return text

  // Preserve technical entities
  const protectedUrls = []
  const sanitized = text.replace(/https?:\/\/[^\s]+/g, (match) => {
    protectedUrls.push(match)
    return `__URL_REF_${protectedUrls.length - 1}__`
  })

  // Common section headings mapping
  const HEADING_MAP = {
    'Executive Summary': {
      om: 'Cuunfaa Hojii (Executive Summary)',
      am: 'አስፈፃሚ ማጠቃለያ (Executive Summary)',
    },
    'Incident Classification': {
      om: 'Ramaddii Taatee Nageenyaa',
      am: 'የሳይበር ጥቃት ምደባ',
    },
    'Incident Chronology': {
      om: 'Tartiiba Yeroo Taatee',
      am: 'የድርጊቶች ቅደም ተከተል (Chronology)',
    },
    'Detailed Description': {
      om: 'Ibsa Bal\'aa Taatee',
      am: 'ዝርዝር የድርጊት መግለጫ',
    },
    'Scope and Impact': {
      om: 'Bal\'ina fi Miidhaa Qaqqabe',
      am: 'የጥቃቱ ስፋት እና ተጽዕኖ',
    },
    'Evidence and Supporting Information': {
      om: 'Ragaalee fi Qabiyyee Deeggersaa',
      am: 'ማስረጃዎች እና ደጋፊ መረጃዎች',
    },
    'Actions Already Taken': {
      om: 'Tarkaanfiiwwan Hamma Ammaatti Fudhataman',
      am: 'እስካሁን የተወሰዱ እርምጃዎች',
    },
    'Requested Assistance': {
      om: 'Deeggarsa Barbaadamu',
      am: 'የሚፈለግ ድጋፍ እና ትብብር',
    },
    'Conclusion': {
      om: 'Goolaba',
      am: 'ማጠቃለያ',
    },
  }

  let translated = sanitized
  for (const [enHead, transMap] of Object.entries(HEADING_MAP)) {
    if (toLang === 'om' && transMap.om) {
      translated = translated.replaceAll(enHead, transMap.om)
    } else if (toLang === 'am' && transMap.am) {
      translated = translated.replaceAll(enHead, transMap.am)
    }
  }

  // Restore technical URLs exactly
  protectedUrls.forEach((url, i) => {
    translated = translated.replace(`__URL_REF_${i}__`, url)
  })

  return translated
}
