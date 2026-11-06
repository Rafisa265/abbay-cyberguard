/**
 * CyberShield Ethiopia — M3 Intelligent Incident-Based Reporting & Routing Engine
 *
 * Provides deterministic, reviewed incident-to-destination recommendations.
 * Select Incident -> Recommended Organization -> Understand Why -> Open Official Portal.
 *
 * Strict Privacy & Safety Invariants:
 * 1. Zero automatic submission. External portal opens strictly upon explicit user click.
 * 2. Never asks for or transmits passwords, PINs, OTP codes, or full card details.
 * 3. Differentiates primary vs secondary destinations with clear operational mandates.
 */

export const INCIDENT_ROUTING_PROFILES = [
  // A. Bank or payment fraud (Commercial Bank of Ethiopia / General Banking)
  {
    id: 'bank_fraud',
    categoryKey: 'm3.routing.cat.bank_fraud',
    titleKey: 'm3.routing.title.bank_fraud',
    icon: '🏦',
    primary: {
      id: 'dest_cbe',
      name: 'Commercial Bank of Ethiopia (CBE) Electronic Fraud Triage',
      logo: '/images/logos/cbe.svg',
      logoAlt: 'Commercial Bank of Ethiopia (CBE) Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.combanketh.et/en/contact-us/',
      actionLabelKey: 'm3.routing.action.open_portal',
      hotline: '8888',
      hotlineLabelKey: 'm3.directory.hotline_label',
      whyKey: 'm3.routing.why.cbe_fraud',
      prepareKey: 'm3.routing.prepare.bank_statement',
      neverShareKey: 'm3.routing.never_share.pin_password',
    },
    secondary: {
      id: 'dest_police_cid',
      name: 'Ethiopian Federal Police Cybercrime Investigation Directorate',
      logo: '/images/logos/federal_police.svg',
      logoAlt: 'Ethiopian Federal Police Official Crest',
      badgeKey: 'm3.routing.badge.secondary',
      badgeClass: 'badge-secondary-rec',
      actionUrl: 'https://www.ethiopianfederalpolice.gov.et/contact',
      actionLabelKey: 'm3.routing.action.view_police_office',
      hotline: '991',
      secondaryPhone: '+251 11 551 2744',
      whyKey: 'm3.routing.why.police_prosecution',
      prepareKey: 'm3.routing.prepare.police_file',
      neverShareKey: 'm3.routing.never_share.bribe_agents',
    },
  },

  // B. Telebirr fraud (Ethio Telecom Mobile Money)
  {
    id: 'telebirr_fraud',
    categoryKey: 'm3.routing.cat.telebirr_fraud',
    titleKey: 'm3.routing.title.telebirr_fraud',
    icon: '📱',
    primary: {
      id: 'dest_telebirr',
      name: 'Ethio Telecom Customer Security & Telebirr Fraud Operations',
      logo: '/images/logos/telebirr.svg',
      logoAlt: 'Ethio Telecom Telebirr Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.ethiotelecom.et/customer-care/',
      actionLabelKey: 'm3.routing.action.open_portal',
      hotline: '127',
      secondaryPhone: '994',
      hotlineLabelKey: 'm3.routing.hotline.telebirr_127',
      ussdCode: '*127#',
      whyKey: 'm3.routing.why.telebirr',
      prepareKey: 'm3.routing.prepare.telebirr_trans',
      neverShareKey: 'm3.routing.never_share.telebirr_pin',
    },
    secondary: {
      id: 'dest_police_cid',
      name: 'Ethiopian Federal Police Cybercrime Directorate',
      logo: '/images/logos/federal_police.svg',
      logoAlt: 'Ethiopian Federal Police Logo',
      badgeKey: 'm3.routing.badge.secondary',
      badgeClass: 'badge-secondary-rec',
      actionUrl: 'https://www.ethiopianfederalpolice.gov.et/contact',
      actionLabelKey: 'm3.routing.action.view_police_office',
      hotline: '991',
      secondaryPhone: '+251 11 551 2744',
      whyKey: 'm3.routing.why.police_fraud',
      prepareKey: 'm3.routing.prepare.telecom_statement',
      neverShareKey: 'm3.routing.never_share.bribe_agents',
    },
  },

  // C. CBE Birr fraud
  {
    id: 'cbe_birr_fraud',
    categoryKey: 'm3.routing.cat.cbe_birr_fraud',
    titleKey: 'm3.routing.title.cbe_birr_fraud',
    icon: '💳',
    primary: {
      id: 'dest_cbe_birr',
      name: 'Commercial Bank of Ethiopia (CBE) / CBE Birr Fraud Freezing',
      logo: '/images/logos/cbe.svg',
      logoAlt: 'CBE Birr Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.combanketh.et/en/contact-us/',
      actionLabelKey: 'm3.routing.action.open_portal',
      hotline: '8888',
      ussdCode: '*889#',
      whyKey: 'm3.routing.why.cbe_birr',
      prepareKey: 'm3.routing.prepare.cbe_birr_trans',
      neverShareKey: 'm3.routing.never_share.pin_password',
    },
    secondary: {
      id: 'dest_insa_cert',
      name: 'Information Network Security Administration (INSA) / Ethio-CERT',
      logo: '/images/logos/insa_cert.svg',
      logoAlt: 'INSA Ethio-CERT Official Shield',
      badgeKey: 'm3.routing.badge.secondary',
      badgeClass: 'badge-secondary-rec',
      actionUrl: 'https://www.ethiocert.et',
      fallbackUrl: 'https://www.ethiocert.gov.et',
      actionLabelKey: 'm3.routing.action.open_cert_portal',
      hotline: '951',
      whyKey: 'm3.routing.why.insa_banking_threat',
      prepareKey: 'm3.routing.prepare.sms_phishing',
      neverShareKey: 'm3.routing.never_share.passwords',
    },
  },

  // D1. Facebook account takeover
  {
    id: 'facebook_takeover',
    categoryKey: 'm3.routing.cat.facebook_takeover',
    titleKey: 'm3.routing.title.facebook_takeover',
    icon: '👤',
    primary: {
      id: 'dest_meta_fb',
      name: 'Meta Platforms (Facebook) Compromised Account Recovery',
      logo: '/images/logos/facebook.svg',
      logoAlt: 'Facebook Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.facebook.com/hacked',
      actionLabelKey: 'm3.routing.action.open_recovery_portal',
      whyKey: 'm3.routing.why.meta_facebook',
      prepareKey: 'm3.routing.prepare.fb_account',
      neverShareKey: 'm3.routing.never_share.recovery_scammers',
    },
    secondary: null,
  },

  // D2. Instagram account takeover
  {
    id: 'instagram_takeover',
    categoryKey: 'm3.routing.cat.instagram_takeover',
    titleKey: 'm3.routing.title.instagram_takeover',
    icon: '📸',
    primary: {
      id: 'dest_meta_ig',
      name: 'Instagram (Meta Trust & Safety) Compromised Account Portal',
      logo: '/images/logos/instagram.svg',
      logoAlt: 'Instagram Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.instagram.com/hacked/',
      actionLabelKey: 'm3.routing.action.open_recovery_portal',
      whyKey: 'm3.routing.why.meta_instagram',
      prepareKey: 'm3.routing.prepare.ig_selfie',
      neverShareKey: 'm3.routing.never_share.recovery_scammers',
    },
    secondary: null,
  },

  // E. Microsoft / Outlook account compromise
  {
    id: 'microsoft_compromise',
    categoryKey: 'm3.routing.cat.microsoft_compromise',
    titleKey: 'm3.routing.title.microsoft_compromise',
    icon: '📧',
    primary: {
      id: 'dest_microsoft_acsr',
      name: 'Microsoft Account Recovery (ACSR) & Outlook Security',
      logo: '/images/logos/microsoft.svg',
      logoAlt: 'Microsoft Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://account.live.com/acsr',
      actionLabelKey: 'm3.routing.action.open_microsoft_acsr',
      secondaryUrl: 'https://msrc.microsoft.com/report/',
      whyKey: 'm3.routing.why.microsoft',
      prepareKey: 'm3.routing.prepare.microsoft_info',
      neverShareKey: 'm3.routing.never_share.authenticator_codes',
    },
    secondary: null,
  },

  // F. Phishing, malware, ransomware or suspicious cyber activity
  {
    id: 'phishing_malware_ransomware',
    categoryKey: 'm3.routing.cat.phishing_malware',
    titleKey: 'm3.routing.title.phishing_malware',
    icon: '🛡️',
    primary: {
      id: 'dest_insa_cert',
      name: 'Information Network Security Administration (INSA) / Ethio-CERT',
      logo: '/images/logos/insa_cert.svg',
      logoAlt: 'INSA Ethio-CERT National Authority Shield',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.ethiocert.et',
      fallbackUrl: 'https://www.ethiocert.gov.et',
      actionLabelKey: 'm3.routing.action.open_cert_portal',
      hotline: '951',
      whyKey: 'm3.routing.why.ethio_cert_national',
      prepareKey: 'm3.routing.prepare.phishing_artifacts',
      neverShareKey: 'm3.routing.never_share.passwords',
    },
    secondary: {
      id: 'dest_police_cid',
      name: 'Ethiopian Federal Police Cybercrime Investigation Directorate',
      logo: '/images/logos/federal_police.svg',
      logoAlt: 'Ethiopian Federal Police Official Crest',
      badgeKey: 'm3.routing.badge.secondary',
      badgeClass: 'badge-secondary-rec',
      actionUrl: 'https://www.ethiopianfederalpolice.gov.et/contact',
      actionLabelKey: 'm3.routing.action.view_police_office',
      hotline: '991',
      secondaryPhone: '+251 11 551 2744',
      whyKey: 'm3.routing.why.police_extortion',
      prepareKey: 'm3.routing.prepare.ransom_notes',
      neverShareKey: 'm3.routing.never_share.ransom_payment',
    },
  },

  // G. SIM swap or telecom account compromise
  {
    id: 'sim_swap_telecom',
    categoryKey: 'm3.routing.cat.sim_swap_telecom',
    titleKey: 'm3.routing.title.sim_swap_telecom',
    icon: '📶',
    primary: {
      id: 'dest_ethio_telecom',
      name: 'Ethio Telecom Customer Security & Carrier Desk',
      logo: '/images/logos/telebirr.svg',
      logoAlt: 'Ethio Telecom Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.ethiotelecom.et/customer-care/',
      actionLabelKey: 'm3.routing.action.open_portal',
      hotline: '994',
      whyKey: 'm3.routing.why.telecom_sim',
      prepareKey: 'm3.routing.prepare.fayda_id',
      neverShareKey: 'm3.routing.never_share.sms_codes',
    },
    secondary: null,
  },

  // H. Cyberbullying, online abuse or harassment
  {
    id: 'harassment_cyberbullying',
    categoryKey: 'm3.routing.cat.harassment',
    titleKey: 'm3.routing.title.harassment',
    icon: '⚖️',
    primary: {
      id: 'dest_platform_abuse',
      name: 'Platform In-App Trust & Safety Reporting (Telegram / Meta)',
      logo: '/images/logos/telegram.svg',
      logoAlt: 'Telegram Official Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://telegram.org/support',
      secondaryUrl: 'https://www.facebook.com/help/contact/295309487309948',
      actionLabelKey: 'm3.routing.action.open_platform_abuse',
      whyKey: 'm3.routing.why.platform_abuse',
      prepareKey: 'm3.routing.prepare.uncropped_screenshots',
      neverShareKey: 'm3.routing.never_share.confront_harasser',
    },
    secondary: {
      id: 'dest_police_cid',
      name: 'Ethiopian Federal Police Cybercrime Directorate',
      logo: '/images/logos/federal_police.svg',
      logoAlt: 'Ethiopian Federal Police Crest',
      badgeKey: 'm3.routing.badge.secondary',
      badgeClass: 'badge-secondary-rec',
      actionUrl: 'https://www.ethiopianfederalpolice.gov.et/contact',
      actionLabelKey: 'm3.routing.action.view_police_office',
      hotline: '991',
      secondaryPhone: '+251 11 551 2744',
      whyKey: 'm3.routing.why.police_threats',
      prepareKey: 'm3.routing.prepare.threat_evidence',
      neverShareKey: 'm3.routing.never_share.delete_messages',
    },
  },

  // I. Personal data exposure / Data breach
  {
    id: 'data_exposure',
    categoryKey: 'm3.routing.cat.data_exposure',
    titleKey: 'm3.routing.title.data_exposure',
    icon: '📂',
    primary: {
      id: 'dest_custodian_org',
      name: 'Responsible Organization Data Protection & Security Officer',
      logo: '/images/logos/insa_cert.svg',
      logoAlt: 'Data Protection Authority Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.ethiocert.gov.et/incident-report',
      actionLabelKey: 'm3.routing.action.open_cert_portal',
      whyKey: 'm3.routing.why.custodian_org',
      prepareKey: 'm3.routing.prepare.breach_fields',
      neverShareKey: 'm3.routing.never_share.exposed_records',
    },
    secondary: {
      id: 'dest_insa_cert',
      name: 'Information Network Security Administration (INSA) / Ethio-CERT',
      logo: '/images/logos/insa_cert.svg',
      logoAlt: 'INSA Ethio-CERT Official Shield',
      badgeKey: 'm3.routing.badge.secondary',
      badgeClass: 'badge-secondary-rec',
      actionUrl: 'https://www.ethiocert.et',
      fallbackUrl: 'https://www.ethiocert.gov.et',
      actionLabelKey: 'm3.routing.action.open_cert_portal',
      hotline: '951',
      whyKey: 'm3.routing.why.insa_national_breach',
      prepareKey: 'm3.routing.prepare.leak_url',
      neverShareKey: 'm3.routing.never_share.passwords',
    },
  },

  // J. Other or unclear incident
  {
    id: 'other_unclear',
    categoryKey: 'm3.routing.cat.other_unclear',
    titleKey: 'm3.routing.title.other_unclear',
    icon: 'ℹ️',
    clarificationNeeded: true,
    primary: {
      id: 'dest_insa_cert',
      name: 'Information Network Security Administration (INSA) / Ethio-CERT',
      logo: '/images/logos/insa_cert.svg',
      logoAlt: 'INSA Ethio-CERT Logo',
      badgeKey: 'm3.routing.badge.primary',
      badgeClass: 'badge-primary-rec',
      actionUrl: 'https://www.ethiocert.et',
      fallbackUrl: 'https://www.ethiocert.gov.et',
      actionLabelKey: 'm3.routing.action.open_cert_portal',
      hotline: '951',
      whyKey: 'm3.routing.why.general_guidance',
      prepareKey: 'm3.routing.prepare.chronological_summary',
      neverShareKey: 'm3.routing.never_share.passwords',
    },
    secondary: null,
  },
]

/**
 * Maps input text or category ID to the official destination recommendation profile.
 */
export function getRecommendedRouting(categoryOrText = '') {
  if (!categoryOrText) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'other_unclear')
  }

  const raw = categoryOrText.trim().toLowerCase()

  // 1. Exact Category ID Match
  const exact = INCIDENT_ROUTING_PROFILES.find((p) => p.id === raw)
  if (exact) return exact

  // 2. High-confidence heuristic keyword mapping
  // B. Telebirr Fraud
  if (
    raw.includes('telebirr') ||
    raw.includes('ቴሌብር') ||
    raw.includes('*127#') ||
    (raw.includes('127') && (raw.includes('sms') || raw.includes('transfer') || raw.includes('dabarsa')))
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'telebirr_fraud')
  }

  // C. CBE Birr Fraud
  if (
    raw.includes('cbe birr') ||
    raw.includes('cbebirr') ||
    raw.includes('ሲቢኢ ብር') ||
    (raw.includes('cbe') && raw.includes('birr')) ||
    raw.includes('*889#')
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'cbe_birr_fraud')
  }

  // A. Bank or payment fraud
  if (
    raw.includes('bank') ||
    raw.includes('cbe') ||
    raw.includes('commercial bank') ||
    raw.includes('baankii') ||
    raw.includes('ባንክ') ||
    raw.includes('account number') ||
    raw.includes('herrega baankii') ||
    raw.includes('atm') ||
    raw.includes('dashen') ||
    raw.includes('awash')
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'bank_fraud')
  }

  // D1. Facebook account takeover
  if (
    raw.includes('facebook') ||
    raw.includes('fb') ||
    raw.includes('ፌስቡክ') ||
    (raw.includes('meta') && !raw.includes('instagram'))
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'facebook_takeover')
  }

  // D2. Instagram account takeover
  if (raw.includes('instagram') || raw.includes('insta') || raw.includes('ኢንስታግራም')) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'instagram_takeover')
  }

  // E. Microsoft / Outlook compromise
  if (
    raw.includes('microsoft') ||
    raw.includes('outlook') ||
    raw.includes('hotmail') ||
    raw.includes('office 365') ||
    raw.includes('ማይክሮሶፍት') ||
    raw.includes('አውትሉክ')
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'microsoft_compromise')
  }

  // G. SIM swap or telecom account compromise
  if (
    raw.includes('sim swap') ||
    raw.includes('sim card') ||
    raw.includes('cellular disconnected') ||
    raw.includes('kaardii sim') ||
    raw.includes('ሲም') ||
    (raw.includes('telecom') && raw.includes('disconnect'))
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'sim_swap_telecom')
  }

  // H. Cyberbullying, online abuse or harassment
  if (
    raw.includes('harassment') ||
    raw.includes('bullying') ||
    raw.includes('blackmail') ||
    raw.includes('extortion') ||
    raw.includes('hacuucaa') ||
    raw.includes('dirqisiisuu') ||
    raw.includes('ማስፈራራት') ||
    raw.includes('ትንኮሳ')
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'harassment_cyberbullying')
  }

  // I. Personal data exposure
  if (
    raw.includes('data exposure') ||
    raw.includes('data breach') ||
    raw.includes('fayda') ||
    raw.includes('kebele') ||
    raw.includes('passport leak') ||
    raw.includes('saaxilamummaa daataa') ||
    raw.includes('የመረጃ መፍሰስ')
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'data_exposure')
  }

  // F. Phishing, malware, ransomware
  if (
    raw.includes('phishing') ||
    raw.includes('malware') ||
    raw.includes('ransomware') ||
    raw.includes('apk') ||
    raw.includes('trojan') ||
    raw.includes('virus') ||
    raw.includes('deceptive link') ||
    raw.includes('geessituu sobaa') ||
    raw.includes('ፊሺንግ') ||
    raw.includes('ማልዌር') ||
    raw.includes('የተቆለፉ ፋይሎች')
  ) {
    return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'phishing_malware_ransomware')
  }

  // Default to Other / Unclear
  return INCIDENT_ROUTING_PROFILES.find((p) => p.id === 'other_unclear')
}

