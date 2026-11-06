/**
 * CyberShield Ethiopia — M3 Platform-Specific Account Recovery & Emergency Triage Engine
 *
 * 100% in-browser offline capability. Zero credential harvesting.
 * Provides authentic, verified official platform recovery workflows,
 * incident diagnosis, emergency actions, and secondary recovery scam defenses.
 */

// 15 Incident Categories defined in Part 3
export const INCIDENT_CATEGORIES = [
  {
    id: 'social_media_compromise',
    icon: '👤',
    titleKey: 'm3.categories.social_media.title',
    descKey: 'm3.categories.social_media.desc',
    severity: 'high',
    defaultSeverity: 'high',
    platforms: ['facebook', 'instagram', 'telegram', 'whatsapp', 'tiktok', 'x_twitter'],
  },
  {
    id: 'email_compromise',
    icon: '✉️',
    titleKey: 'm3.categories.email.title',
    descKey: 'm3.categories.email.desc',
    severity: 'critical',
    defaultSeverity: 'critical',
    platforms: ['google_gmail', 'microsoft', 'yahoo', 'apple_id'],
  },
  {
    id: 'banking_fraud',
    icon: '🏦',
    titleKey: 'm3.categories.banking.title',
    descKey: 'm3.categories.banking.desc',
    severity: 'urgent',
    defaultSeverity: 'urgent',
    platforms: ['cbe', 'dashen', 'awash', 'boa', 'coop', 'telebirr'],
  },
  {
    id: 'mobile_money_fraud',
    icon: '📱',
    titleKey: 'm3.categories.mobile_money.title',
    descKey: 'm3.categories.mobile_money.desc',
    severity: 'urgent',
    defaultSeverity: 'urgent',
    platforms: ['telebirr', 'cbe_birr', 'amole'],
  },
  {
    id: 'phishing_impersonation',
    icon: '🎣',
    titleKey: 'm3.categories.phishing.title',
    descKey: 'm3.categories.phishing.desc',
    severity: 'medium',
    defaultSeverity: 'medium',
    platforms: ['generic'],
  },
  {
    id: 'identity_theft',
    icon: '🪪',
    titleKey: 'm3.categories.identity.title',
    descKey: 'm3.categories.identity.desc',
    severity: 'high',
    defaultSeverity: 'high',
    platforms: ['fayda', 'national_id', 'passport'],
  },
  {
    id: 'data_breach',
    icon: '🗄️',
    titleKey: 'm3.categories.data_breach.title',
    descKey: 'm3.categories.data_breach.desc',
    severity: 'high',
    defaultSeverity: 'high',
    platforms: ['organization'],
  },
  {
    id: 'malware_infection',
    icon: '🦠',
    titleKey: 'm3.categories.malware.title',
    descKey: 'm3.categories.malware.desc',
    severity: 'high',
    defaultSeverity: 'high',
    platforms: ['android_apk', 'windows_pc'],
  },
  {
    id: 'ransomware',
    icon: '🔒',
    titleKey: 'm3.categories.ransomware.title',
    descKey: 'm3.categories.ransomware.desc',
    severity: 'urgent',
    defaultSeverity: 'urgent',
    platforms: ['organization', 'windows_pc'],
  },
  {
    id: 'unauthorized_access',
    icon: '🚪',
    titleKey: 'm3.categories.unauthorized.title',
    descKey: 'm3.categories.unauthorized.desc',
    severity: 'high',
    defaultSeverity: 'high',
    platforms: ['system_server'],
  },
  {
    id: 'bec_fraud',
    icon: '💼',
    titleKey: 'm3.categories.bec.title',
    descKey: 'm3.categories.bec.desc',
    severity: 'urgent',
    defaultSeverity: 'urgent',
    platforms: ['organization_email'],
  },
  {
    id: 'online_harassment',
    icon: '⚠️',
    titleKey: 'm3.categories.harassment.title',
    descKey: 'm3.categories.harassment.desc',
    severity: 'medium',
    defaultSeverity: 'medium',
    platforms: ['social_media'],
  },
  {
    id: 'sim_swap_telecom',
    icon: '📶',
    titleKey: 'm3.categories.sim_swap.title',
    descKey: 'm3.categories.sim_swap.desc',
    severity: 'urgent',
    defaultSeverity: 'urgent',
    platforms: ['ethio_telecom', 'safaricom'],
  },
  {
    id: 'website_defacement_dos',
    icon: '🌐',
    titleKey: 'm3.categories.website_defacement.title',
    descKey: 'm3.categories.website_defacement.desc',
    severity: 'high',
    defaultSeverity: 'high',
    platforms: ['web_server'],
  },
  {
    id: 'other_cyber_incident',
    icon: '🛡️',
    titleKey: 'm3.categories.other.title',
    descKey: 'm3.categories.other.desc',
    severity: 'medium',
    defaultSeverity: 'medium',
    platforms: ['generic'],
  },
]

// Natural language classifier for 15 categories (multilingual EN, OM, AM, mixed)
export function classifyIncidentCategory(text) {
  if (!text || typeof text !== 'string') return 'other_cyber_incident'
  const t = text.toLowerCase()

  // 1. Online harassment / Blackmail / Cyberbullying (prioritized even if platform mentioned)
  if (/harass|blackmail|threat|extort|intimidate|defam|doxx|nude|dhiibbaa|sodachiisa|ማስፈራራት|ማዋከብ|ጥቃት/.test(t)) {
    return 'online_harassment'
  }

  // 2. Social media compromise (prioritized over generic 'account/herrega' matches)
  if (
    /facebook|fb|instagram|telegram|whatsapp|tiktok|snapchat|youtube|x_twitter|twitter/.test(t) ||
    /herregni telegram|herregni facebook|herregni whatsapp|የፌስቡክ|የቴሌግራም|የዋትስአፕ|የኢንስታግራም/.test(t) ||
    (/password changed|account hacked|compromised my account|na jalaa hatame|የይለፍ ቃሌ ተቀይሯል|አካውንቴ ተጠልፎ/.test(t) &&
     !/bank|cbe|telebirr|sim|invoice/.test(t))
  ) {
    return 'social_media_compromise'
  }

  // 2. Mobile money fraud
  if (/telebirr|cbe birr|cbebirr|amole|mobile money|\*127#|ቴሌብር|ሲቢኢ ብር|ሞባይል ገንዘብ/.test(t)) {
    return 'mobile_money_fraud'
  }

  // 3. SIM swap & telecom
  if (/sim|sim card|sim swap|no service|carrier|cellular|kaardii sim|sim cufame|ሲም|ሲም ካርድ|ሲም ስዋፕ|ኔትወርክ ጠፋ/.test(t)) {
    return 'sim_swap_telecom'
  }

  // 4. Ransomware
  if (/ransom|ransomware|encrypted files|\.locked|decryptor|bitcoin ransom|kriptoo|faayila cufame|ፋይል ተቆለፈ|ክፍያ ጠየቁ|ራንሰምዌር/.test(t)) {
    return 'ransomware'
  }

  // 5. Malware / APK
  if (/apk|malware|virus|trojan|spyware|installed app|battery drain|unwanted app|accessibility permission|screen permission|vaayirasii|appii sobaa|ቫይረስ|ማልዌር|ኤፒኬ|ያልታወቀ መተግበሪያ/.test(t)) {
    return 'malware_infection'
  }

  // 6. BEC / Business Email Compromise
  if (/invoice|vendor|supplier|wire transfer|ceo fraud|director email|gabaasa kaffaltii|የክፍያ መጠየቂያ|የአቅራቢ|የድርጅት ኢሜይል/.test(t)) {
    return 'bec_fraud'
  }

  // 7. Identity theft
  if (/identity|fayda|national id|kebele id|passport|impersonating me|maqaa kootiin|eenyummaa|መታወቂያ|ፋይዳ|ፓስፖርት|ስሜን ተጠቅመው/.test(t)) {
    return 'identity_theft'
  }

  // 8. Website / DoS
  if (/website defaced|site down|ddos|dos attack|syn flood|portal is down|portal down|marsariitii cufame|ድረ-ገጽ ተዘጋ|ድረ-ገጽ ተቀየረ/.test(t)) {
    return 'website_defacement_dos'
  }

  // 10. Banking & financial fraud
  if (
    /bank|cbe|awash|dashen|atm|account balance|unauthorized transfer|debit withdrawal|withdrawal|baankii|herrega|qarshii|ባንክ|ሂሳብ|ያለፈቃድ|የባንክ|ብር|ዝውውር/.test(t)
  ) {
    return 'banking_fraud'
  }

  // 11. Email compromise
  if (/gmail|google account|yahoo|outlook|hotmail|email hacked|password reset email|imeelii|iimeeyilii|ኢሜይል|ኢሜል/.test(t)) {
    return 'email_compromise'
  }

  // 12. Data breach
  if (/data breach|database leak|customer records|customer info|leaked online|ragaan dhangala'e|ዳታ ሌክ|የደንበኞች መረጃ|መረጃ ወጣ/.test(t)) {
    return 'data_breach'
  }

  // 13. Phishing
  if (/phish|phishing|fake link|suspicious link|lottery link|won prize|linkii sobaa|badhaasa|ሊንክ|የተጭበረበረ ሊንክ|ሎተሪ አሸነፉ/.test(t)) {
    return 'phishing_impersonation'
  }

  // 14. Unauthorized access
  if (/server accessed|ssh brute|admin access|unauthorized access|seensa hayyama malee|ያለፈቃድ መግባት/.test(t)) {
    return 'unauthorized_access'
  }

  return 'other_cyber_incident'
}

// Platform recovery directory with verified URLs
export const PLATFORM_RECOVERY_GUIDES = {
  facebook: {
    name: 'Facebook / Meta',
    icon: '📘',
    officialUrl: 'https://www.facebook.com',
    recoveryUrl: 'https://www.facebook.com/hacked',
    identifyUrl: 'https://www.facebook.com/login/identify',
    safetyCenterUrl: 'https://www.meta.com/safety/',
    keyQuestions: [
      { id: 'has_access', qKey: 'm3.recovery.fb.q_access' },
      { id: 'has_email', qKey: 'm3.recovery.fb.q_email' },
      { id: 'phone_changed', qKey: 'm3.recovery.fb.q_phone' },
      { id: 'contacts_messaged', qKey: 'm3.recovery.fb.q_contacts' },
    ],
    recoveryStepsKey: 'm3.recovery.fb.steps',
    reportingStepsKey: 'm3.recovery.fb.report',
    scamWarningKey: 'm3.recovery.fb.warning',
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    officialUrl: 'https://www.instagram.com',
    recoveryUrl: 'https://www.instagram.com/hacked/',
    identifyUrl: 'https://help.instagram.com/368191326593075',
    safetyCenterUrl: 'https://about.instagram.com/community/safety',
    keyQuestions: [
      { id: 'has_access', qKey: 'm3.recovery.ig.q_access' },
      { id: 'email_notification_received', qKey: 'm3.recovery.ig.q_email_notif' },
      { id: 'video_selfie_available', qKey: 'm3.recovery.ig.q_selfie' },
    ],
    recoveryStepsKey: 'm3.recovery.ig.steps',
    reportingStepsKey: 'm3.recovery.ig.report',
    scamWarningKey: 'm3.recovery.ig.warning',
  },
  whatsapp: {
    name: 'WhatsApp',
    icon: '💬',
    officialUrl: 'https://www.whatsapp.com',
    recoveryUrl: 'https://faq.whatsapp.com/1131652977782073',
    identifyUrl: 'https://www.whatsapp.com/contact',
    safetyCenterUrl: 'https://www.whatsapp.com/security',
    keyQuestions: [
      { id: 'can_receive_sms', qKey: 'm3.recovery.wa.q_sms' },
      { id: 'two_step_locked', qKey: 'm3.recovery.wa.q_2step' },
      { id: 'contacts_fraud_alerted', qKey: 'm3.recovery.wa.q_alerted' },
    ],
    recoveryStepsKey: 'm3.recovery.wa.steps',
    reportingStepsKey: 'm3.recovery.wa.report',
    scamWarningKey: 'm3.recovery.wa.warning',
  },
  telegram: {
    name: 'Telegram',
    icon: '✈️',
    officialUrl: 'https://telegram.org',
    recoveryUrl: 'https://telegram.org/faq#compromised-accounts',
    identifyUrl: 'https://telegram.org/support',
    safetyCenterUrl: 'https://telegram.org/privacy',
    keyQuestions: [
      { id: 'active_sessions_visible', qKey: 'm3.recovery.tg.q_sessions' },
      { id: 'two_step_enabled', qKey: 'm3.recovery.tg.q_2step' },
      { id: 'sim_active', qKey: 'm3.recovery.tg.q_sim' },
    ],
    recoveryStepsKey: 'm3.recovery.tg.steps',
    reportingStepsKey: 'm3.recovery.tg.report',
    scamWarningKey: 'm3.recovery.tg.warning',
  },
  google_gmail: {
    name: 'Google / Gmail',
    icon: '📧',
    officialUrl: 'https://accounts.google.com',
    recoveryUrl: 'https://accounts.google.com/signin/recovery',
    identifyUrl: 'https://myaccount.google.com/security-checkup',
    safetyCenterUrl: 'https://safety.google',
    keyQuestions: [
      { id: 'backup_email_accessible', qKey: 'm3.recovery.google.q_backup_email' },
      { id: 'recovery_phone_accessible', qKey: 'm3.recovery.google.q_phone' },
      { id: 'familiar_device_available', qKey: 'm3.recovery.google.q_device' },
    ],
    recoveryStepsKey: 'm3.recovery.google.steps',
    reportingStepsKey: 'm3.recovery.google.report',
    scamWarningKey: 'm3.recovery.google.warning',
  },
  microsoft: {
    name: 'Microsoft / Outlook',
    icon: '💻',
    officialUrl: 'https://account.microsoft.com',
    recoveryUrl: 'https://account.live.com/acsr',
    identifyUrl: 'https://account.microsoft.com/security',
    safetyCenterUrl: 'https://www.microsoft.com/en-us/security',
    keyQuestions: [
      { id: 'alternate_email_valid', qKey: 'm3.recovery.ms.q_alt_email' },
      { id: 'knows_recent_contacts', qKey: 'm3.recovery.ms.q_recent' },
    ],
    recoveryStepsKey: 'm3.recovery.ms.steps',
    reportingStepsKey: 'm3.recovery.ms.report',
    scamWarningKey: 'm3.recovery.ms.warning',
  },
  telebirr: {
    name: 'Ethio Telecom / Telebirr',
    icon: '🇪🇹',
    officialUrl: 'https://www.ethiotelecom.et',
    recoveryUrl: 'https://www.ethiotelecom.et/telebirr/',
    identifyUrl: 'tel:994',
    safetyCenterUrl: 'https://www.ethiotelecom.et/customer-care/',
    hotline: '994',
    keyQuestions: [
      { id: 'account_locked', qKey: 'm3.recovery.tb.q_locked' },
      { id: 'unauthorized_pin_change', qKey: 'm3.recovery.tb.q_pin' },
      { id: 'unauthorized_transfers_seen', qKey: 'm3.recovery.tb.q_transfer' },
    ],
    recoveryStepsKey: 'm3.recovery.tb.steps',
    reportingStepsKey: 'm3.recovery.tb.report',
    scamWarningKey: 'm3.recovery.tb.warning',
  },
  cbe: {
    name: 'Commercial Bank of Ethiopia (CBE)',
    icon: '🏛️',
    officialUrl: 'https://www.combanketh.et',
    recoveryUrl: 'https://www.combanketh.et/en/contact-us/',
    identifyUrl: 'tel:951',
    safetyCenterUrl: 'https://www.combanketh.et',
    hotline: '951 / 8888',
    keyQuestions: [
      { id: 'cbebirr_or_mobile_app', qKey: 'm3.recovery.cbe.q_channel' },
      { id: 'called_hotline_951', qKey: 'm3.recovery.cbe.q_called' },
      { id: 'account_frozen_requested', qKey: 'm3.recovery.cbe.q_frozen' },
    ],
    recoveryStepsKey: 'm3.recovery.cbe.steps',
    reportingStepsKey: 'm3.recovery.cbe.report',
    scamWarningKey: 'm3.recovery.cbe.warning',
  },
}

// Emergency safety actions based on incident category
export function getEmergencyContainmentActions(category) {
  switch (category) {
    case 'banking_fraud':
    case 'mobile_money_fraud':
      return [
        { id: 'em_call_bank', actionKey: 'm3.emergency.call_bank', urgent: true },
        { id: 'em_freeze_acc', actionKey: 'm3.emergency.freeze_account', urgent: true },
        { id: 'em_preserve_sms', actionKey: 'm3.emergency.preserve_sms_trans', urgent: false },
        { id: 'em_file_police', actionKey: 'm3.emergency.file_police_994', urgent: false },
      ]
    case 'sim_swap_telecom':
      return [
        { id: 'em_call_carrier', actionKey: 'm3.emergency.call_telecom_994', urgent: true },
        { id: 'em_alert_bank_sim', actionKey: 'm3.emergency.alert_bank_phone_lost', urgent: true },
        { id: 'em_visit_branch', actionKey: 'm3.emergency.visit_telecom_branch', urgent: false },
      ]
    case 'malware_infection':
    case 'ransomware':
      return [
        { id: 'em_disconnect_net', actionKey: 'm3.emergency.disconnect_network', urgent: true },
        { id: 'em_no_creds', actionKey: 'm3.emergency.do_not_enter_credentials', urgent: true },
        { id: 'em_boot_safe', actionKey: 'm3.emergency.boot_safe_mode', urgent: false },
        { id: 'em_backup_external', actionKey: 'm3.emergency.preserve_encrypted_state', urgent: false },
      ]
    case 'social_media_compromise':
    case 'email_compromise':
      return [
        { id: 'em_secure_email', actionKey: 'm3.emergency.secure_recovery_email', urgent: true },
        { id: 'em_official_recovery', actionKey: 'm3.emergency.use_official_portal_only', urgent: true },
        { id: 'em_alert_friends', actionKey: 'm3.emergency.warn_contacts_fraud', urgent: false },
        { id: 'em_terminate_sessions', actionKey: 'm3.emergency.kill_active_sessions', urgent: false },
      ]
    case 'bec_fraud':
    case 'data_breach':
    case 'unauthorized_access':
      return [
        { id: 'em_isolate_workstation', actionKey: 'm3.emergency.isolate_endpoint', urgent: true },
        { id: 'em_revoke_tokens', actionKey: 'm3.emergency.revoke_api_tokens', urgent: true },
        { id: 'em_notify_cert', actionKey: 'm3.emergency.notify_insa_cert_951', urgent: false },
        { id: 'em_preserve_logs', actionKey: 'm3.emergency.export_audit_logs', urgent: false },
      ]
    default:
      return [
        { id: 'em_stop_interaction', actionKey: 'm3.emergency.stop_suspicious_interaction', urgent: true },
        { id: 'em_screenshot_evidence', actionKey: 'm3.emergency.capture_unaltered_evidence', urgent: false },
        { id: 'em_change_passwords', actionKey: 'm3.emergency.rotate_affected_passwords', urgent: false },
      ]
  }
}

// Secondary Recovery Scam Red Flags
export const RECOVERY_SCAM_FLAGS = [
  'm3.recovery_scam.flag_fee',
  'm3.recovery_scam.flag_otp',
  'm3.recovery_scam.flag_telegram_agent',
  'm3.recovery_scam.flag_remote_software',
  'm3.recovery_scam.flag_fake_guarantee',
]
