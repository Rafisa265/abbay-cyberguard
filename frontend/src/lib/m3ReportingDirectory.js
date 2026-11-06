/**
 * CyberShield Ethiopia — Official Incident Reporting Directory
 *
 * Curated authentic channels with explicit operational scopes and limitations.
 * Distinguishes national CSIRT authorities, law enforcement crime investigation,
 * telecom fraud desks, financial institutions, and global platform recovery portals.
 */

export const OFFICIAL_REPORTING_DIRECTORY = [
  // 1. INSA / Ethio-CERT (National Authority)
  {
    id: 'rep_insa_cert',
    name: 'Information Network Security Administration (INSA) / Ethio-CERT',
    scope: 'ethiopia_national',
    categories: ['data_breach', 'ransomware', 'unauthorized_access', 'website_defacement_dos', 'bec_fraud', 'malware_infection'],
    website: 'https://www.insa.gov.et',
    reportingUrl: 'https://www.ethiocert.et',
    fallbackUrl: 'https://www.ethiocert.gov.et',
    phoneHotline: '951',
    methods: ['phone_hotline', 'online_portal', 'in_person'],
    officeLocation: 'Addis Ababa, Ethiopia (Behind Ministry of Foreign Affairs)',
    badgeKey: 'm3.directory.badge.official',
    logo: '/images/logos/insa_cert.svg',
    logoAlt: 'INSA Ethio-CERT National Authority Logo',
    verifiedLimitationsKey: 'm3.directory.insa.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.insa.notes',
  },

  // 2. Ethiopian Federal Police Cybercrime Investigation Directorate
  {
    id: 'rep_federal_police',
    name: 'Ethiopian Federal Police Cybercrime Investigation Directorate',
    scope: 'ethiopia_national',
    categories: ['banking_fraud', 'mobile_money_fraud', 'identity_theft', 'online_harassment', 'social_media_compromise', 'ransomware'],
    website: 'https://www.ethiopianfederalpolice.gov.et',
    reportingUrl: 'https://www.ethiopianfederalpolice.gov.et/contact',
    phoneHotline: '991',
    secondaryPhone: '+251 11 551 2744',
    methods: ['phone_hotline', 'in_person', 'written_petition'],
    officeLocation: 'Federal Police Crime Investigation Bureau, Mexico Square, Addis Ababa',
    badgeKey: 'm3.directory.badge.official',
    logo: '/images/logos/federal_police.svg',
    logoAlt: 'Ethiopian Federal Police Cyber Crime Directorate Logo',
    verifiedLimitationsKey: 'm3.directory.police.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.police.notes',
  },

  // 3. Ethio Telecom Customer Security & Fraud Desk
  {
    id: 'rep_ethio_telecom',
    name: 'Ethio Telecom Customer Security & Telebirr Fraud Operations',
    scope: 'ethiopia_telecom',
    categories: ['sim_swap_telecom', 'mobile_money_fraud', 'phishing_impersonation'],
    website: 'https://www.ethiotelecom.et',
    reportingUrl: 'https://www.ethiotelecom.et/customer-care/',
    phoneHotline: '994',
    ussdCode: '*127#',
    methods: ['phone_hotline', 'ussd', 'telecom_shop_in_person'],
    officeLocation: 'Any official Ethio Telecom branch nationwide',
    badgeKey: 'm3.directory.badge.telecom',
    logo: '/images/logos/telebirr.svg',
    logoAlt: 'Ethio Telecom Telebirr Official Logo',
    verifiedLimitationsKey: 'm3.directory.telecom.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.telecom.notes',
  },

  // 4. Commercial Bank of Ethiopia (CBE) Fraud Freezing
  {
    id: 'rep_cbe_fraud',
    name: 'Commercial Bank of Ethiopia (CBE) Electronic Fraud Freezing',
    scope: 'ethiopia_financial',
    categories: ['banking_fraud', 'mobile_money_fraud'],
    website: 'https://www.combanketh.et',
    reportingUrl: 'https://www.combanketh.et/en/contact-us/',
    phoneHotline: '8888',
    secondaryPhone: '+251 11 551 5004',
    methods: ['phone_hotline', 'bank_branch_in_person'],
    officeLocation: 'CBE Headquarters (Churchill Ave) or any local branch nationwide',
    badgeKey: 'm3.directory.badge.financial',
    logo: '/images/logos/cbe.svg',
    logoAlt: 'Commercial Bank of Ethiopia (CBE) Official Logo',
    verifiedLimitationsKey: 'm3.directory.cbe.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.cbe.notes',
  },

  // 5. National Bank of Ethiopia (NBE) Financial Consumer Protection
  {
    id: 'rep_nbe_regulator',
    name: 'National Bank of Ethiopia (NBE) Financial Consumer Protection Directorate',
    scope: 'ethiopia_financial',
    categories: ['banking_fraud', 'mobile_money_fraud', 'data_breach'],
    website: 'https://nbe.gov.et',
    reportingUrl: 'https://nbe.gov.et',
    phoneHotline: '+251 11 551 7430',
    methods: ['online_portal', 'written_petition'],
    officeLocation: 'Sudan Street, Addis Ababa',
    badgeKey: 'm3.directory.badge.official',
    logo: '/images/logos/nbe.svg',
    logoAlt: 'National Bank of Ethiopia (NBE) Central Regulatory Seal',
    verifiedLimitationsKey: 'm3.directory.nbe.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.nbe.notes',
  },

  // 6. Meta / Facebook & Instagram Security Operations
  {
    id: 'rep_meta_security',
    name: 'Meta Platforms (Facebook & Instagram) Trust & Safety',
    scope: 'global_platform',
    categories: ['social_media_compromise', 'phishing_impersonation', 'online_harassment'],
    website: 'https://www.meta.com',
    reportingUrl: 'https://www.facebook.com/hacked',
    secondaryUrl: 'https://help.instagram.com/contact/383679321740945',
    methods: ['online_portal', 'in_app_report'],
    badgeKey: 'm3.directory.badge.global',
    logo: '/images/logos/facebook.svg',
    logoAlt: 'Meta Platforms Official Logo',
    verifiedLimitationsKey: 'm3.directory.meta.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.meta.notes',
  },

  // 7. Google / Gmail Account Security
  {
    id: 'rep_google_security',
    name: 'Google Account & Gmail Security Operations',
    scope: 'global_platform',
    categories: ['email_compromise', 'phishing_impersonation', 'unauthorized_access'],
    website: 'https://myaccount.google.com',
    reportingUrl: 'https://accounts.google.com/signin/recovery',
    secondaryUrl: 'https://support.google.com/mail/contact/abuse',
    methods: ['online_portal'],
    badgeKey: 'm3.directory.badge.global',
    logo: '/images/logos/google.svg',
    logoAlt: 'Google Official Security Logo',
    verifiedLimitationsKey: 'm3.directory.google.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.google.notes',
  },

  // 8. Telegram Messenger Trust & Abuse Operations
  {
    id: 'rep_telegram_abuse',
    name: 'Telegram Messenger Trust & Safety',
    scope: 'global_platform',
    categories: ['social_media_compromise', 'phishing_impersonation', 'online_harassment'],
    website: 'https://telegram.org',
    reportingUrl: 'https://telegram.org/support',
    emailContact: 'abuse@telegram.org',
    methods: ['in_app_report', 'email_direct'],
    badgeKey: 'm3.directory.badge.global',
    logo: '/images/logos/telegram.svg',
    logoAlt: 'Telegram Official Logo',
    verifiedLimitationsKey: 'm3.directory.telegram.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.telegram.notes',
  },

  // 9. Microsoft Security Response Center (MSRC)
  {
    id: 'rep_microsoft_msrc',
    name: 'Microsoft Security Response Center (MSRC) & Outlook Trust',
    scope: 'global_platform',
    categories: ['email_compromise', 'bec_fraud', 'ransomware', 'unauthorized_access'],
    website: 'https://msrc.microsoft.com',
    reportingUrl: 'https://account.live.com/acsr',
    secondaryUrl: 'https://msrc.microsoft.com/report/',
    methods: ['online_portal'],
    badgeKey: 'm3.directory.badge.global',
    logo: '/images/logos/microsoft.svg',
    logoAlt: 'Microsoft Security Official Logo',
    verifiedLimitationsKey: 'm3.directory.microsoft.limitations',
    lastVerified: 'October 2026',
    notesKey: 'm3.directory.microsoft.notes',
  },
]

// Query and filter reporting directory
export function filterReportingDirectory(query = '', categoryFilter = null, scopeFilter = null) {
  return OFFICIAL_REPORTING_DIRECTORY.filter((res) => {
    if (categoryFilter && categoryFilter !== 'all') {
      if (!res.categories.includes(categoryFilter)) return false
    }
    if (scopeFilter && scopeFilter !== 'all') {
      if (res.scope !== scopeFilter) return false
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      const matchName = res.name.toLowerCase().includes(q)
      const matchPhone = (res.phoneHotline || '').includes(q) || (res.secondaryPhone || '').includes(q)
      const matchUrl = (res.reportingUrl || '').toLowerCase().includes(q) || (res.website || '').toLowerCase().includes(q)
      return matchName || matchPhone || matchUrl
    }
    return true
  })
}
