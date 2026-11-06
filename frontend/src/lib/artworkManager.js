/**
 * Cyber Hero Journey & Educational Modules — Dynamic Artwork Pipeline
 * 
 * Provides:
 * 1. Structured scenario-to-artwork prompt derivation.
 * 2. 100% offline-first deterministic fallback selection.
 * 3. Client session caching to avoid redundant render or generation requests.
 * 4. Zero Math.random, zero direct unvetted network calls (SR-09 compliant).
 */

export const CATEGORY_ARTWORK_MAP = {
  phishing_advance_fee: '/images/journey/m01_scholarship_phishing.svg',
  credential_harvesting_telecom: '/images/journey/m02_sim_upgrade.svg',
  fake_banking_bot: '/images/journey/m03_banking_bot.svg',
  malicious_apk_telegram: '/images/journey/m04_malicious_apk.svg',
  fake_job_offers: '/images/journey/p01_fake_job.svg',
  password_safety: '/images/journey/p02_password_sync.svg',
  suspicious_links: '/images/journey/p03_qr_phishing.svg',
  social_engineering: '/images/journey/p04_social_transfer.svg',
  privacy_incident_response: '/images/journey/p05_data_leak.svg',
  account_security: '/images/journey/p02_password_sync.svg',
  procedural_defense: '/images/journey/practice_adaptive.svg',
  phishing_anatomy: '/images/journey/phishing_anatomy.svg',
  password_entropy: '/images/journey/password_entropy_matrix.svg',
  incident_workflow: '/images/journey/incident_timeline_workflow.svg',
  defense_in_depth: '/images/journey/defense_in_depth_shield.svg',
  website_tls: '/images/journey/website_tls_security.svg',
  arena_command: '/images/journey/arena_battle_command.svg',
  arena_grandmaster: '/images/journey/arena_grandmaster.svg',
  daily_calendar: '/images/journey/daily_defense_calendar.svg',
}

export const ACADEMY_TOPIC_ARTWORK_MAP = {
  phishing: '/images/journey/phishing_anatomy.svg',
  password: '/images/journey/password_entropy_matrix.svg',
  privacy: '/images/journey/incident_timeline_workflow.svg',
  response: '/images/journey/incident_timeline_workflow.svg',
  website: '/images/journey/website_tls_security.svg',
  defense_in_depth: '/images/journey/defense_in_depth_shield.svg',
  arena_command: '/images/journey/arena_battle_command.svg',
  arena_grandmaster: '/images/journey/arena_grandmaster.svg',
  daily_challenge: '/images/journey/daily_defense_calendar.svg',
}

export const MODULE_ARTWORK_MAP = {
  m1: '/images/journey/m1_link_scanner.svg',
  m2: '/images/journey/m2_password_vault.svg',
  m3: '/images/journey/m3_incident_dossier.svg',
  m4: '/images/journey/m4_security_scanner.svg',
  m5: '/images/journey/m5_academy_matrix.svg',
}

export const SPECIFIC_MISSION_ARTWORK_MAP = {
  m01: '/images/journey/m01_scholarship_phishing.svg',
  m02: '/images/journey/m02_sim_upgrade.svg',
  m03: '/images/journey/m03_banking_bot.svg',
  m04: '/images/journey/m04_malicious_apk.svg',
  p01: '/images/journey/p01_fake_job.svg',
  p02: '/images/journey/p02_password_sync.svg',
  p03: '/images/journey/p03_qr_phishing.svg',
  p04: '/images/journey/p04_social_transfer.svg',
  p05: '/images/journey/p05_data_leak.svg',
  p06: '/images/journey/p06_compromised_peer.svg',
  p07: '/images/journey/p02_password_sync.svg',
  p08: '/images/journey/p02_password_sync.svg',
  p09: '/images/journey/p03_qr_phishing.svg',
  p10: '/images/journey/m02_sim_upgrade.svg',
  p11: '/images/journey/p05_data_leak.svg',
  p12: '/images/journey/p06_compromised_peer.svg',
}

export const SCENARIO_METADATA_REGISTRY = {
  m01: {
    threat_type: 'Advance-fee scholarship scam',
    character: 'Sufian (Student)',
    environment: 'University student dorm in Addis Ababa',
    key_elements: ['Holographic cyber shield', 'Phishing link alert', 'Ethiopian telemetry lines'],
  },
  m02: {
    threat_type: 'Telecom SIM swap OTP harvesting',
    character: 'Selam (Mobile User)',
    environment: 'Telecom transmission network and cellular gateway',
    key_elements: ['Cellular tower telemetry', 'Encrypted SIM card vault', 'One-Time Password shield'],
  },
  m03: {
    threat_type: 'Automated fake banking chat bot',
    character: 'Dawit (Banking Customer)',
    environment: 'Mobile banking application and chat stream',
    key_elements: ['Digital Birr vault', 'Rogue automated bot intercept', 'Banking credential shield'],
  },
  m04: {
    threat_type: 'Malicious Android APK sideloading trojan',
    character: 'Hana (Job Applicant)',
    environment: 'Android device OS security perimeter',
    key_elements: ['Quarantined APK package', 'Dangerous permission blocks', 'Play Protect scanner'],
  },
  p01: {
    threat_type: 'Fake campus job offer with upfront fee',
    character: 'Abel (Hawassa University Student)',
    environment: 'Campus career notice board and Telegram chat',
    key_elements: ['Fraudulent employment contract', '500 ETB fee alert', 'University career seal'],
  },
  p02: {
    threat_type: 'Urgent student portal password sync lure',
    character: 'Tigist (University Student)',
    environment: 'Campus academic registration portal',
    key_elements: ['Spoofed login dialog', '15-minute countdown ring', 'Password entropy padlock'],
  },
  p03: {
    threat_type: 'Cafe flyer QR code phishing scam',
    character: 'Robel (Student)',
    environment: 'Campus coffee house and physical poster',
    key_elements: ['Scanning laser reticle', 'QR matrix trap', 'Official USSD verification badge'],
  },
  p04: {
    threat_type: 'Fake transfer SMS and frantic refund call',
    character: 'Aster (Mobile Money User)',
    environment: 'Mobile money notification channel and voice call',
    key_elements: ['Audio waveform telemetry', 'Spoofed 2500 ETB notice', 'USSD balance check badge'],
  },
  p05: {
    threat_type: 'Data breach lookup secondary harvesting trap',
    character: 'Biniam (Student)',
    environment: 'Academic leak forum and credential lookup form',
    key_elements: ['Breached database cylinder', 'National ID scanner', 'M3 incident report badge'],
  },
  p06: {
    threat_type: 'Compromised peer account distributing exam APK',
    character: 'Lemlem (Graduating Student)',
    environment: 'Direct messaging channel from hijacked peer',
    key_elements: ['Compromised peer alert', 'Direct APK bypass warning', 'Out-of-band verification'],
  },
}

/**
 * Accurately resolves the underlying template ID ('m01'-'m04' or 'p01'-'p06')
 * from a mission object or identifier, preventing cross-contamination between
 * generated practice IDs and campaign missions.
 */
export function resolveMissionTemplateId(mission) {
  if (!mission) return null
  let id = ''
  let baseId = ''
  let code = ''
  let category = ''

  if (typeof mission === 'string') {
    id = mission.trim().toLowerCase()
  } else if (typeof mission === 'object') {
    id = typeof mission.id === 'string' ? mission.id.trim().toLowerCase() : ''
    baseId = typeof mission.base_template_id === 'string' ? mission.base_template_id.trim().toLowerCase() : ''
    code = typeof mission.code === 'string' ? mission.code.trim().toLowerCase() : ''
    category = typeof mission.category === 'string' ? mission.category.trim().toLowerCase() : ''
  }

  // 1. Authoritative base template ID (m01..m04, p01..p06)
  if (baseId) {
    if (/^m0[1-4]$/i.test(baseId)) return baseId.toLowerCase()
    const pMatch = baseId.match(/^p0?([1-6])$/i)
    if (pMatch) return 'p0' + pMatch[1]
    const pCodeMatch = baseId.match(/(?:mission[_\-]?p|practice[_\-]?0?)([1-9][0-9]*)/i)
    if (pCodeMatch) {
      const num = parseInt(pCodeMatch[1], 10)
      if (num >= 1 && num <= 6) return 'p0' + num
      return 'p0' + (((num - 1) % 6) + 1)
    }
    const pSubMatch = baseId.match(/(?:^|[^a-z0-9])p0?([1-6])(?:[^a-z0-9]|$)/i)
    if (pSubMatch) return 'p0' + pSubMatch[1]
    const legacyGenMatch = baseId.match(/(?:^|[^a-z0-9])(?:gen_m_?0?|m0)([56])(?:[^a-z0-9]|$)/i)
    if (legacyGenMatch) return 'p0' + legacyGenMatch[1]
  }

  // 2. Direct mission ID
  if (/^m0[1-4]$/i.test(id)) return id.toLowerCase()
  const directPMatch = id.match(/^p0?([1-6])$/i)
  if (directPMatch) return 'p0' + directPMatch[1]

  // 3. Explicit code or ID matching legacy MISSION_P* or PRACTICE_* sequences
  const codeTarget = code || id
  const pCodeMatch = codeTarget.match(/(?:mission[_\-]?p|practice[_\-]?0?)([1-9][0-9]*)/i)
  if (pCodeMatch) {
    const num = parseInt(pCodeMatch[1], 10)
    if (num >= 1 && num <= 6) return 'p0' + num
    return 'p0' + (((num - 1) % 6) + 1)
  }

  // 4. Embedded practice template pattern (e.g., gen_m_p01..., gen_p01, etc.)
  const pMatch = id.match(/(?:^|[^a-z0-9])p0?([1-6])(?:[^a-z0-9]|$)/i)
  if (pMatch) {
    return 'p0' + pMatch[1]
  }

  // Handle gen_m05 / gen_m_05 / gen_m06 (which are legacy generated practice IDs for P05/P06)
  const legacyGenMatch = id.match(/(?:^|[^a-z0-9])(?:gen_m_?0?|m0)([56])(?:[^a-z0-9]|$)/i)
  if (legacyGenMatch) {
    return 'p0' + legacyGenMatch[1]
  }

  // 5. Practice category matching (guaranteed distinct from campaign categories)
  const catToCheck = category || id
  if (catToCheck.includes('fake_job_offers')) return 'p01'
  if (catToCheck.includes('password_safety')) return 'p02'
  if (catToCheck.includes('suspicious_links')) return 'p03'
  if (catToCheck.includes('social_engineering')) return 'p04'
  if (catToCheck.includes('privacy_incident_response')) return 'p05'
  if (catToCheck.includes('malicious_apk') && !id.includes('m04')) return 'p06'

  // 6. Campaign match only when not a generated practice mission
  if (!id.startsWith('gen_') && !id.startsWith('mission_p') && !id.startsWith('practice_')) {
    if (catToCheck.includes('phishing_advance_fee')) return 'm01'
    if (catToCheck.includes('credential_harvesting_telecom')) return 'm02'
    if (catToCheck.includes('fake_banking_bot')) return 'm03'
    if (catToCheck.includes('malicious_apk_telegram')) return 'm04'
    const mMatch = id.match(/\b(m0[1-4])\b/)
    if (mMatch) return mMatch[1]
  }

  return null
}

/**
 * Derives a sanitized, structured prompt specification from mission metadata.
 * Strips all sensitive information, passwords, and external user URLs.
 */
export function deriveArtworkPromptSpec(mission) {
  if (!mission || typeof mission !== 'object') {
    return {
      mission_id: 'unknown',
      category: 'procedural_defense',
      threat_type: 'Defensive cybersecurity simulation',
      character: 'Cyber Defense Sentinel',
      environment: 'Cyberspace defensive telemetry network',
      key_elements: ['Cyber shield', 'Neural matrix nodes'],
      difficulty: 'intermediate',
      style_guide: 'Futuristic cybersecurity game concept art, dark navy and deep indigo background, electric cyan and blue neon lighting, readable composition, subtle Ethiopian context, no text',
    }
  }

  const templateId = resolveMissionTemplateId(mission)
  const baseMeta = (templateId && SCENARIO_METADATA_REGISTRY[templateId]) || (mission.id && SCENARIO_METADATA_REGISTRY[mission.id]) || {}
  const category = mission.category || 'procedural_defense'
  const threatType = baseMeta.threat_type || category.replace(/_/g, ' ')
  const character = baseMeta.character || 'Cyber Defense Cadet'
  const environment = baseMeta.environment || 'Digital defense terminal in Ethiopia'
  const keyElements = baseMeta.key_elements || ['Protective cyber shield', 'Telemetry network']

  return {
    mission_id: mission.id,
    code: mission.code || 'MISSION',
    category,
    threat_type: threatType,
    character,
    environment,
    key_elements: keyElements,
    difficulty: mission.difficulty || 'intermediate',
    style_guide: 'Futuristic cybersecurity game concept art, dark navy and deep indigo background, electric cyan and blue neon lighting, readable composition, subtle Ethiopian context, no text',
  }
}

/**
 * Deterministically resolves the offline fallback artwork URL.
 * Guarantees a matching, high-quality local vector asset with zero latency.
 */
export function getFallbackArtwork(mission) {
  if (!mission) return '/images/journey/practice_adaptive.svg'

  const templateId = resolveMissionTemplateId(mission)

  // 1. Direct template match via resolved template ID (p01-p06, m01-m04)
  if (templateId && SPECIFIC_MISSION_ARTWORK_MAP[templateId]) {
    return SPECIFIC_MISSION_ARTWORK_MAP[templateId]
  }

  // 2. Direct ID match if in specific map
  if (mission.id && SPECIFIC_MISSION_ARTWORK_MAP[mission.id]) {
    return SPECIFIC_MISSION_ARTWORK_MAP[mission.id]
  }

  // 3. Pre-assigned mission artwork URL (guarding against cross-mission misdirection and generic difficulty overrides)
  if (mission.artwork_url && typeof mission.artwork_url === 'string') {
    const isPractice = (templateId && templateId.startsWith('p')) || (typeof mission.id === 'string' && mission.id.startsWith('gen_'))
    const isCampaignArtwork = mission.artwork_url.includes('/m0')
    const isGenericDifficulty = mission.artwork_url.includes('/diff_')
    if (!(isPractice && isCampaignArtwork) && !isGenericDifficulty) {
      return mission.artwork_url
    }
  }

  // 4. Category match
  if (mission.category && CATEGORY_ARTWORK_MAP[mission.category]) {
    return CATEGORY_ARTWORK_MAP[mission.category]
  }

  // 5. Difficulty tier fallback
  if (mission.difficulty === 'beginner') return '/images/journey/diff_beginner.svg'
  if (mission.difficulty === 'intermediate') return '/images/journey/diff_intermediate.svg'
  if (mission.difficulty === 'advanced') return '/images/journey/diff_advanced.svg'

  // 6. Global safe fallback
  return '/images/journey/practice_adaptive.svg'
}

/**
 * Resolves localized alt key for mission artwork.
 * Prioritizes explicit key, base template (m01-m04, p01-p06), category, and finally safe fallback.
 */
export function getArtworkAltKey(mission) {
  if (!mission) return 'journey.artwork_fallback_alt'

  const templateId = resolveMissionTemplateId(mission)
  if (templateId && ['m01', 'm02', 'm03', 'm04', 'p01', 'p02', 'p03', 'p04', 'p05', 'p06'].includes(templateId)) {
    return `journey.${templateId}.artwork_alt`
  }

  // Check explicit key guarding against practice misdirection
  if (mission.artwork_alt_key) {
    const isPractice = (templateId && templateId.startsWith('p')) || (typeof mission.id === 'string' && mission.id.startsWith('gen_'))
    const isCampaignAlt = mission.artwork_alt_key.includes('.m0')
    if (!(isPractice && isCampaignAlt)) {
      return mission.artwork_alt_key
    }
  }

  // Check category map for alt keys if templateId not matched
  const CATEGORY_ALT_MAP = {
    fake_job_offers: 'journey.p01.artwork_alt',
    password_safety: 'journey.p02.artwork_alt',
    suspicious_links: 'journey.p03.artwork_alt',
    social_engineering: 'journey.p04.artwork_alt',
    privacy_incident_response: 'journey.p05.artwork_alt',
    account_security: 'journey.p02.artwork_alt',
    phishing_advance_fee: 'journey.m01.artwork_alt',
    credential_harvesting_telecom: 'journey.m02.artwork_alt',
    fake_banking_bot: 'journey.m03.artwork_alt',
    malicious_apk_telegram: 'journey.m04.artwork_alt',
  }
  if (mission.category && CATEGORY_ALT_MAP[mission.category]) {
    return CATEGORY_ALT_MAP[mission.category]
  }

  return 'journey.practice.artwork_alt'
}

// In-memory session cache for AI artwork status
const artworkSessionCache = new Map()

export function getCachedArtworkStatus(missionId) {
  return artworkSessionCache.get(missionId) || null
}

export function setCachedArtworkStatus(missionId, statusObj) {
  if (missionId && statusObj) {
    artworkSessionCache.set(missionId, statusObj)
  }
}
