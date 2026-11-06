/**
 * Cyber Hero Journey - Mission Schema & Validation Rules
 * 
 * Reusable schema validator for both reviewed offline mission templates
 * and future validated AI mission imports.
 */

export const MISSION_CATEGORIES = [
  'phishing_advance_fee',
  'credential_harvesting_telecom',
  'fake_banking_bot',
  'malicious_apk_telegram',
  'procedural_defense',
  'suspicious_links',
  'account_security',
  'password_safety',
  'social_engineering',
  'fake_job_offers',
  'privacy_incident_response',
]

export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced']

export const SAFE_DOMAINS = [
  '.invalid',
  '.example',
  '.test',
  '.example.com',
  '.example.org',
  '.example.net',
]

/**
 * Validates a mission object against the Cyber Hero Journey schema.
 * 
 * @param {object} m - Mission candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMission(m) {
  const errors = []

  if (!m || typeof m !== 'object') {
    return { valid: false, errors: ['Mission must be an object'] }
  }

  // Required basic metadata
  if (!m.id || typeof m.id !== 'string') errors.push('Missing or invalid mission id')
  if (!m.code || typeof m.code !== 'string') errors.push('Missing or invalid mission code')
  if (!MISSION_CATEGORIES.includes(m.category)) {
    errors.push(`Invalid category: "${m.category}". Allowed: ${MISSION_CATEGORIES.join(', ')}`)
  }
  if (!DIFFICULTY_LEVELS.includes(m.difficulty)) {
    errors.push(`Invalid difficulty: "${m.difficulty}". Allowed: ${DIFFICULTY_LEVELS.join(', ')}`)
  }
  if (!m.badge_id || typeof m.badge_id !== 'string') errors.push('Missing or invalid badge_id')
  if (typeof m.xp_reward !== 'number' || m.xp_reward <= 0) {
    errors.push('xp_reward must be a positive integer')
  }

  // Translation keys & Story
  if (!m.title_key || typeof m.title_key !== 'string') errors.push('Missing title_key')
  if (!m.subtitle_key || typeof m.subtitle_key !== 'string') errors.push('Missing subtitle_key')
  if (!m.story_key || typeof m.story_key !== 'string') errors.push('Missing story_key')
  if (!m.sender_name_key || typeof m.sender_name_key !== 'string') errors.push('Missing sender_name_key')

  // Fictional & Safe Simulation Guards (RFC 2606)
  if (!m.target_url || typeof m.target_url !== 'string') {
    errors.push('Missing target_url')
  } else {
    const isSafeDomain = SAFE_DOMAINS.some((d) => m.target_url.includes(d))
    if (!isSafeDomain) {
      errors.push(`target_url must use an RFC 2606 reserved testing domain (e.g. .invalid, .example, or .example.com/.net/.org) for safety. Got: ${m.target_url}`)
    }
  }

  // Evidence Items
  if (!Array.isArray(m.evidence_items) || m.evidence_items.length < 3) {
    errors.push('evidence_items must be an array of at least 3 evidence objects')
  } else {
    m.evidence_items.forEach((ev, idx) => {
      if (!ev.id || !ev.title_key || !ev.desc_key || !ev.icon) {
        errors.push(`evidence_items[${idx}] missing required fields (id, title_key, desc_key, icon)`)
      }
    })
  }

  // Choices & Decision Matrix
  if (!Array.isArray(m.choices) || m.choices.length < 3) {
    errors.push('choices must be an array of at least 3 choice objects')
  } else {
    let correctCount = 0
    m.choices.forEach((c, idx) => {
      if (!c.id || !c.label_key || !c.feedback_key || !c.icon) {
        errors.push(`choices[${idx}] missing required fields (id, label_key, feedback_key, icon)`)
      }
      if (c.isCorrect) correctCount++
    })
    if (correctCount !== 1) {
      errors.push(`Mission must have exactly 1 correct choice. Found: ${correctCount}`)
    }
  }

  // Debrief Takeaways
  if (!Array.isArray(m.debrief_rules) || m.debrief_rules.length < 3) {
    errors.push('debrief_rules must be an array of at least 3 rule keys')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
