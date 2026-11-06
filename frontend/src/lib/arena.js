// Cyber Attack & Defense Arena - Core Game Engine & Scenario Definitions
// Educational simulation module: All scenarios and telemetry are fictional and safe.

import { getJourneyProgress, saveJourneyProgress } from './journey.js'
import { saveProgress } from './api.js'
import { getCachedNotifications, saveCachedNotifications } from './notificationStorage.js'

export const ARENA_MODES = ['attack', 'defense', 'battle']
ARENA_MODES.ATTACK = 'attack'
ARENA_MODES.DEFENSE = 'defense'
ARENA_MODES.BATTLE = 'battle'

export const ARENA_DIFFICULTIES = ['beginner', 'intermediate', 'advanced']
ARENA_DIFFICULTIES.BEGINNER = 'beginner'
ARENA_DIFFICULTIES.INTERMEDIATE = 'intermediate'
ARENA_DIFFICULTIES.ADVANCED = 'advanced'

export const TIER_XP_REWARDS = {
  beginner: 50,
  intermediate: 75,
  advanced: 100,
}

export const TIER_UNLOCK_THRESHOLDS = {
  beginner: 0,      // Always unlocked
  intermediate: 3,  // Complete 3 Beginner scenarios
  advanced: 3,      // Complete 3 Intermediate scenarios
}

/**
 * 9 Predefined, Safe, Educational Scenarios
 * Distributed evenly: 3 tiers x 3 modes (Attack, Defense, Battle)
 */
const RAW_SCENARIOS = [
  // 1. Beginner - Attack Mode
  {
    id: 'arena_att_beg_01',
    mode: 'attack',
    difficulty: 'beginner',
    xpReward: 50,
    titleKey: 'arena.scenarios.att_beg_01.title',
    descKey: 'arena.scenarios.att_beg_01.desc',
    telemetryType: 'sms',
    telemetryContent: 'ETH-TEL-PROMO: Urgent! You won 150,000 ETB in the 2026 Telecom Anniversary! Send 500 ETB processing fee via Telebirr to 0911-XXXXXX within 20 mins to claim your prize voucher.',
    hintKey: 'arena.scenarios.att_beg_01.hint',
    questionKey: 'arena.scenarios.att_beg_01.question',
    optionsKeys: [
      'arena.scenarios.att_beg_01.opt_0',
      'arena.scenarios.att_beg_01.opt_1',
      'arena.scenarios.att_beg_01.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.att_beg_01.explanation',
    badgeId: 'badge_threat_spotter',
  },

  // 2. Beginner - Defense Mode
  {
    id: 'arena_def_beg_01',
    mode: 'defense',
    difficulty: 'beginner',
    xpReward: 50,
    titleKey: 'arena.scenarios.def_beg_01.title',
    descKey: 'arena.scenarios.def_beg_01.desc',
    telemetryType: 'alert',
    telemetryContent: 'IDENTITY GUARD ALERT [Severity: HIGH]: Clinic Nurse account (nurse.almaz@ruralhealth.et) logged in from unexpected foreign IP (198.51.100.82) at 02:44 AM EAT using default password. Records database accessed.',
    hintKey: 'arena.scenarios.def_beg_01.hint',
    questionKey: 'arena.scenarios.def_beg_01.question',
    optionsKeys: [
      'arena.scenarios.def_beg_01.opt_0',
      'arena.scenarios.def_beg_01.opt_1',
      'arena.scenarios.def_beg_01.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.def_beg_01.explanation',
    badgeId: 'badge_defense_specialist',
  },

  // 3. Beginner - Battle Mode
  {
    id: 'arena_bat_beg_01',
    mode: 'battle',
    difficulty: 'beginner',
    xpReward: 50,
    titleKey: 'arena.scenarios.bat_beg_01.title',
    descKey: 'arena.scenarios.bat_beg_01.desc',
    telemetryType: 'email',
    telemetryContent: 'From: accounting-billing@internal-notice-dept.com\nTo: finance@agri-corp.et\nSubject: Overdue Supplier Invoice - Immediate Settlement\nAttachment: Invoice_October_Statement.exe (1.4 MB)\n\n"Please inspect the attached overdue billing file and remit payment by end of business."',
    hintKey: 'arena.scenarios.bat_beg_01.hint',
    badgeId: 'badge_battle_strategist',
    stages: [
      {
        stageNumber: 1,
        titleKey: 'arena.scenarios.bat_beg_01.s1_title',
        questionKey: 'arena.scenarios.bat_beg_01.s1_question',
        optionsKeys: [
          'arena.scenarios.bat_beg_01.s1_opt_0',
          'arena.scenarios.bat_beg_01.s1_opt_1',
          'arena.scenarios.bat_beg_01.s1_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_beg_01.s1_explanation',
      },
      {
        stageNumber: 2,
        titleKey: 'arena.scenarios.bat_beg_01.s2_title',
        questionKey: 'arena.scenarios.bat_beg_01.s2_question',
        optionsKeys: [
          'arena.scenarios.bat_beg_01.s2_opt_0',
          'arena.scenarios.bat_beg_01.s2_opt_1',
          'arena.scenarios.bat_beg_01.s2_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_beg_01.s2_explanation',
      },
    ],
  },

  // 4. Intermediate - Attack Mode
  {
    id: 'arena_att_int_01',
    mode: 'attack',
    difficulty: 'intermediate',
    xpReward: 75,
    titleKey: 'arena.scenarios.att_int_01.title',
    descKey: 'arena.scenarios.att_int_01.desc',
    telemetryType: 'url',
    telemetryContent: 'Target URI: https://corporate-cbe-birr-portal.et-verify.net/auth/login?client_id=fin_cbe\nTLS Certificate: Issued by FreeSSL (Valid 90 days)\nIssuer Org: Not Provided / Cloudflare DNS Proxy\nDestination: 203.0.113.45',
    hintKey: 'arena.scenarios.att_int_01.hint',
    questionKey: 'arena.scenarios.att_int_01.question',
    optionsKeys: [
      'arena.scenarios.att_int_01.opt_0',
      'arena.scenarios.att_int_01.opt_1',
      'arena.scenarios.att_int_01.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.att_int_01.explanation',
    badgeId: 'badge_threat_spotter',
  },

  // 5. Intermediate - Defense Mode
  {
    id: 'arena_def_int_01',
    mode: 'defense',
    difficulty: 'intermediate',
    xpReward: 75,
    titleKey: 'arena.scenarios.def_int_01.title',
    descKey: 'arena.scenarios.def_int_01.desc',
    telemetryType: 'syslog',
    telemetryContent: 'Oct 22 14:12:01 edge-auth sshd[40192]: Failed password for invalid user admin from 192.0.2.14 port 51102 ssh2\nOct 22 14:12:02 edge-auth sshd[40195]: Failed password for root from 192.0.2.14 port 51104 ssh2\nOct 22 14:12:03 edge-auth sshd[40198]: Failed password for operator from 192.0.2.14 port 51106 ssh2\n[542 failed attempts in past 90 seconds from 192.0.2.14]',
    hintKey: 'arena.scenarios.def_int_01.hint',
    questionKey: 'arena.scenarios.def_int_01.question',
    optionsKeys: [
      'arena.scenarios.def_int_01.opt_0',
      'arena.scenarios.def_int_01.opt_1',
      'arena.scenarios.def_int_01.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.def_int_01.explanation',
    badgeId: 'badge_defense_specialist',
  },

  // 6. Intermediate - Battle Mode
  {
    id: 'arena_bat_int_01',
    mode: 'battle',
    difficulty: 'intermediate',
    xpReward: 75,
    titleKey: 'arena.scenarios.bat_int_01.title',
    descKey: 'arena.scenarios.bat_int_01.desc',
    telemetryType: 'netflow',
    telemetryContent: 'FIREWALL SIEM FLOW-LOG:\nSRC: 10.0.4.15 (HQ-Workstation-4)\nDST: 198.51.100.99:443 [Observed C2 CobaltStrike Profile]\nBytes Transferred: 840 MB (Outbound continuous stream)\nProtocol: TLS (Self-signed untrusted cert)',
    hintKey: 'arena.scenarios.bat_int_01.hint',
    badgeId: 'badge_battle_strategist',
    stages: [
      {
        stageNumber: 1,
        titleKey: 'arena.scenarios.bat_int_01.s1_title',
        questionKey: 'arena.scenarios.bat_int_01.s1_question',
        optionsKeys: [
          'arena.scenarios.bat_int_01.s1_opt_0',
          'arena.scenarios.bat_int_01.s1_opt_1',
          'arena.scenarios.bat_int_01.s1_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_int_01.s1_explanation',
      },
      {
        stageNumber: 2,
        titleKey: 'arena.scenarios.bat_int_01.s2_title',
        questionKey: 'arena.scenarios.bat_int_01.s2_question',
        optionsKeys: [
          'arena.scenarios.bat_int_01.s2_opt_0',
          'arena.scenarios.bat_int_01.s2_opt_1',
          'arena.scenarios.bat_int_01.s2_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_int_01.s2_explanation',
      },
    ],
  },

  // 7. Advanced - Attack Mode
  {
    id: 'arena_att_adv_01',
    mode: 'attack',
    difficulty: 'advanced',
    xpReward: 100,
    titleKey: 'arena.scenarios.att_adv_01.title',
    descKey: 'arena.scenarios.att_adv_01.desc',
    telemetryType: 'terminal',
    telemetryContent: 'devuser@fin-gateway:~$ sudo -l\nMatching Defaults entries for devuser on fin-gateway:\n    env_reset, mail_badpass\nUser devuser may run the following commands on fin-gateway:\n    (ALL : ALL) NOPASSWD: /usr/bin/find\ndevuser@fin-gateway:~$ sudo find . -exec /bin/sh \\; -quit\n# whoami\nroot',
    hintKey: 'arena.scenarios.att_adv_01.hint',
    questionKey: 'arena.scenarios.att_adv_01.question',
    optionsKeys: [
      'arena.scenarios.att_adv_01.opt_0',
      'arena.scenarios.att_adv_01.opt_1',
      'arena.scenarios.att_adv_01.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.att_adv_01.explanation',
    badgeId: 'badge_threat_spotter',
  },

  // 8. Advanced - Defense Mode
  {
    id: 'arena_def_adv_01',
    mode: 'defense',
    difficulty: 'advanced',
    xpReward: 100,
    titleKey: 'arena.scenarios.def_adv_01.title',
    descKey: 'arena.scenarios.def_adv_01.desc',
    telemetryType: 'cve',
    telemetryContent: 'SECURITY ADVISORY CVE-2026-9871 [CVSS 9.8 CRITICAL]: Unauthenticated Remote Code Execution in Core Payment Switch Dispatcher. Exploitation observed in the wild. Vendor patch scheduled in 48 hours. Service downtime incurs penalty of 200,000 ETB/hr.',
    hintKey: 'arena.scenarios.def_adv_01.hint',
    questionKey: 'arena.scenarios.def_adv_01.question',
    optionsKeys: [
      'arena.scenarios.def_adv_01.opt_0',
      'arena.scenarios.def_adv_01.opt_1',
      'arena.scenarios.def_adv_01.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.def_adv_01.explanation',
    badgeId: 'badge_defense_specialist',
  },

  // 9. Advanced - Battle Mode
  {
    id: 'arena_bat_adv_01',
    mode: 'battle',
    difficulty: 'advanced',
    xpReward: 100,
    titleKey: 'arena.scenarios.bat_adv_01.title',
    descKey: 'arena.scenarios.bat_adv_01.desc',
    telemetryType: 'edr',
    telemetryContent: 'EDR HOST INCIDENT ALERT:\nHost: HIS-DB-01 (Hospital Patient Management Server)\nProcess: vssadmin.exe delete shadows /all /quiet\nParent: powershell.exe -enc SQBFAFgA... (Base64 Encoded In-Memory Loader)\nFile System: High frequency write operations detected (.locked extension added to /data/patient_records/)',
    hintKey: 'arena.scenarios.bat_adv_01.hint',
    badgeId: 'badge_arena_master',
    stages: [
      {
        stageNumber: 1,
        titleKey: 'arena.scenarios.bat_adv_01.s1_title',
        questionKey: 'arena.scenarios.bat_adv_01.s1_question',
        optionsKeys: [
          'arena.scenarios.bat_adv_01.s1_opt_0',
          'arena.scenarios.bat_adv_01.s1_opt_1',
          'arena.scenarios.bat_adv_01.s1_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_adv_01.s1_explanation',
      },
      {
        stageNumber: 2,
        titleKey: 'arena.scenarios.bat_adv_01.s2_title',
        questionKey: 'arena.scenarios.bat_adv_01.s2_question',
        optionsKeys: [
          'arena.scenarios.bat_adv_01.s2_opt_0',
          'arena.scenarios.bat_adv_01.s2_opt_1',
          'arena.scenarios.bat_adv_01.s2_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_adv_01.s2_explanation',
      },
    ],
  },

  // 10. Beginner - Attack Mode (Social Media Prize Scam)
  {
    id: 'arena_att_beg_02',
    mode: 'attack',
    difficulty: 'beginner',
    xpReward: 50,
    titleKey: 'arena.scenarios.att_beg_02.title',
    descKey: 'arena.scenarios.att_beg_02.desc',
    telemetryType: 'social',
    telemetryContent: 'TELEGRAM NOTIFICATION: You were added to "National Lottery Administration — Official 2026 Winner Selection".\nUser @NatLotteryAdmin_BOT: "Congratulations! You won 250,000 ETB! To claim your check at head office, transfer 750 ETB stamp tax fee via Telebirr to 0988-XXXXXX within 1 hour."',
    hintKey: 'arena.scenarios.att_beg_02.hint',
    questionKey: 'arena.scenarios.att_beg_02.question',
    optionsKeys: [
      'arena.scenarios.att_beg_02.opt_0',
      'arena.scenarios.att_beg_02.opt_1',
      'arena.scenarios.att_beg_02.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.att_beg_02.explanation',
    badgeId: 'badge_threat_spotter',
  },

  // 11. Beginner - Defense Mode (Public Shared Computer Session)
  {
    id: 'arena_def_beg_02',
    mode: 'defense',
    difficulty: 'beginner',
    xpReward: 50,
    titleKey: 'arena.scenarios.def_beg_02.title',
    descKey: 'arena.scenarios.def_beg_02.desc',
    telemetryType: 'browser',
    telemetryContent: 'SHARED KIOSK BROWSER DIAGNOSTIC:\nLocation: Public Cyber Cafe / University Computer Center\nActive State: Previous user walked away without closing browser window.\nSession: Active webmail session cookies and cached credentials found in local storage.',
    hintKey: 'arena.scenarios.def_beg_02.hint',
    questionKey: 'arena.scenarios.def_beg_02.question',
    optionsKeys: [
      'arena.scenarios.def_beg_02.opt_0',
      'arena.scenarios.def_beg_02.opt_1',
      'arena.scenarios.def_beg_02.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.def_beg_02.explanation',
    badgeId: 'badge_defense_specialist',
  },

  // 12. Beginner - Battle Mode (Telecom SIM Swap Vishing Call)
  {
    id: 'arena_bat_beg_02',
    mode: 'battle',
    difficulty: 'beginner',
    xpReward: 50,
    titleKey: 'arena.scenarios.bat_beg_02.title',
    descKey: 'arena.scenarios.bat_beg_02.desc',
    telemetryType: 'voice',
    telemetryContent: 'CALL TELEMETRY: Inbound Call from +251 90 123 4567\nCaller: "Greetings from Ethio Telecom Customer Operations. We detected network degradation on your SIM card. To upgrade to 5G uninterrupted service, read back the 6-digit confirmation code just sent to your phone."',
    hintKey: 'arena.scenarios.bat_beg_02.hint',
    badgeId: 'badge_battle_strategist',
    stages: [
      {
        stageNumber: 1,
        titleKey: 'arena.scenarios.bat_beg_02.s1_title',
        questionKey: 'arena.scenarios.bat_beg_02.s1_question',
        optionsKeys: [
          'arena.scenarios.bat_beg_02.s1_opt_0',
          'arena.scenarios.bat_beg_02.s1_opt_1',
          'arena.scenarios.bat_beg_02.s1_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_beg_02.s1_explanation',
      },
      {
        stageNumber: 2,
        titleKey: 'arena.scenarios.bat_beg_02.s2_title',
        questionKey: 'arena.scenarios.bat_beg_02.s2_question',
        optionsKeys: [
          'arena.scenarios.bat_beg_02.s2_opt_0',
          'arena.scenarios.bat_beg_02.s2_opt_1',
          'arena.scenarios.bat_beg_02.s2_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_beg_02.s2_explanation',
      },
    ],
  },

  // 13. Intermediate - Attack Mode (Payment QR Phishing - Quishing)
  {
    id: 'arena_att_int_02',
    mode: 'attack',
    difficulty: 'intermediate',
    xpReward: 75,
    titleKey: 'arena.scenarios.att_int_02.title',
    descKey: 'arena.scenarios.att_int_02.desc',
    telemetryType: 'qr',
    telemetryContent: 'PAYMENT QR SCANNER AUDIT:\nPhysical Location: Cafe Table Stand #12, Bole, Addis Ababa\nQR Payload: http://synthetic-telebirr-pay.sample-merchant.internal/bill/settle?amount=480\nVisual Inspection: Glossy sticker overlay found placed on top of authentic acrylic merchant stand.',
    hintKey: 'arena.scenarios.att_int_02.hint',
    questionKey: 'arena.scenarios.att_int_02.question',
    optionsKeys: [
      'arena.scenarios.att_int_02.opt_0',
      'arena.scenarios.att_int_02.opt_1',
      'arena.scenarios.att_int_02.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.att_int_02.explanation',
    badgeId: 'badge_threat_spotter',
  },

  // 14. Intermediate - Defense Mode (Public Git API Secret Exposure)
  {
    id: 'arena_def_int_02',
    mode: 'defense',
    difficulty: 'intermediate',
    xpReward: 75,
    titleKey: 'arena.scenarios.def_int_02.title',
    descKey: 'arena.scenarios.def_int_02.desc',
    telemetryType: 'git',
    telemetryContent: 'SECRET SCANNER ALERT [High Severity]:\nRepository: github.com/ethio-developer/fintech-payment-bridge\nCommit: "feat: add payment gateway credentials"\nExposed Secret: TELEBIRR_MERCHANT_KEY="tb_live_secret_998182747192847192837198"',
    hintKey: 'arena.scenarios.def_int_02.hint',
    questionKey: 'arena.scenarios.def_int_02.question',
    optionsKeys: [
      'arena.scenarios.def_int_02.opt_0',
      'arena.scenarios.def_int_02.opt_1',
      'arena.scenarios.def_int_02.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.def_int_02.explanation',
    badgeId: 'badge_defense_specialist',
  },

  // 15. Intermediate - Battle Mode (Spear-Phishing Macro Attachment)
  {
    id: 'arena_bat_int_02',
    mode: 'battle',
    difficulty: 'intermediate',
    xpReward: 75,
    titleKey: 'arena.scenarios.bat_int_02.title',
    descKey: 'arena.scenarios.bat_int_02.desc',
    telemetryType: 'email',
    telemetryContent: 'EMAIL SECURITY GATEWAY INCIDENT:\nSubject: MOE University Research Grant Disbursement Notification\nFrom: grant-notice@ministry-education-grants.et.org\nAttachment: Grant_Disbursement_Schedule.xlsm (VBA Macro Embedded)\nPrompt: "Enable Editing and Macros to decrypt budget lines."',
    hintKey: 'arena.scenarios.bat_int_02.hint',
    badgeId: 'badge_battle_strategist',
    stages: [
      {
        stageNumber: 1,
        titleKey: 'arena.scenarios.bat_int_02.s1_title',
        questionKey: 'arena.scenarios.bat_int_02.s1_question',
        optionsKeys: [
          'arena.scenarios.bat_int_02.s1_opt_0',
          'arena.scenarios.bat_int_02.s1_opt_1',
          'arena.scenarios.bat_int_02.s1_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_int_02.s1_explanation',
      },
      {
        stageNumber: 2,
        titleKey: 'arena.scenarios.bat_int_02.s2_title',
        questionKey: 'arena.scenarios.bat_int_02.s2_question',
        optionsKeys: [
          'arena.scenarios.bat_int_02.s2_opt_0',
          'arena.scenarios.bat_int_02.s2_opt_1',
          'arena.scenarios.bat_int_02.s2_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_int_02.s2_explanation',
      },
    ],
  },

  // 16. Advanced - Attack Mode (Supply Chain Dependency Confusion)
  {
    id: 'arena_att_adv_02',
    mode: 'attack',
    difficulty: 'advanced',
    xpReward: 100,
    titleKey: 'arena.scenarios.att_adv_02.title',
    descKey: 'arena.scenarios.att_adv_02.desc',
    telemetryType: 'supplychain',
    telemetryContent: 'SOFTWARE COMPONENT ANALYSIS (SCA) ALERT:\nPackage: @ethio-switch/payment-core (v2.4.1)\nRegistry: public npmjs.org registry\nInternal Target: Private artifact repo package namespace\nBehavior: Post-install script executes curl to exfiltrate env vars to external endpoint.',
    hintKey: 'arena.scenarios.att_adv_02.hint',
    questionKey: 'arena.scenarios.att_adv_02.question',
    optionsKeys: [
      'arena.scenarios.att_adv_02.opt_0',
      'arena.scenarios.att_adv_02.opt_1',
      'arena.scenarios.att_adv_02.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.att_adv_02.explanation',
    badgeId: 'badge_threat_spotter',
  },

  // 17. Advanced - Defense Mode (Ransomware Precursor EDR Termination)
  {
    id: 'arena_def_adv_02',
    mode: 'defense',
    difficulty: 'advanced',
    xpReward: 100,
    titleKey: 'arena.scenarios.def_adv_02.title',
    descKey: 'arena.scenarios.def_adv_02.desc',
    telemetryType: 'edr',
    telemetryContent: 'SOC HOST THREAT DETECTION:\nHost: FIN-AUTH-SRV03 (Core Banking Identity Provider)\nEvent: PowerShell executing Base64 encoded payload: `Set-MpPreference -DisableRealtimeMonitoring $true`\nChild Process: cmd.exe calling `netsh advfirewall set allprofiles state off`',
    hintKey: 'arena.scenarios.def_adv_02.hint',
    questionKey: 'arena.scenarios.def_adv_02.question',
    optionsKeys: [
      'arena.scenarios.def_adv_02.opt_0',
      'arena.scenarios.def_adv_02.opt_1',
      'arena.scenarios.def_adv_02.opt_2',
    ],
    correctChoice: 1,
    explanationKey: 'arena.scenarios.def_adv_02.explanation',
    badgeId: 'badge_defense_specialist',
  },

  // 18. Advanced - Battle Mode (Critical SCADA Infrastructure APT Intrusion)
  {
    id: 'arena_bat_adv_02',
    mode: 'battle',
    difficulty: 'advanced',
    xpReward: 100,
    titleKey: 'arena.scenarios.bat_adv_02.title',
    descKey: 'arena.scenarios.bat_adv_02.desc',
    telemetryType: 'siem',
    telemetryContent: 'CRITICAL INFRASTRUCTURE SIEM CORRELATION:\nTarget: National Power Grid SCADA Regional Substation Switch\nTelemetry: Anomalous Kerberos Ticket Granting Service (TGS) requests for service accounts, followed by unauthorized SMB lateral traversal to substation controller 10.200.4.12.',
    hintKey: 'arena.scenarios.bat_adv_02.hint',
    badgeId: 'badge_arena_grandmaster',
    stages: [
      {
        stageNumber: 1,
        titleKey: 'arena.scenarios.bat_adv_02.s1_title',
        questionKey: 'arena.scenarios.bat_adv_02.s1_question',
        optionsKeys: [
          'arena.scenarios.bat_adv_02.s1_opt_0',
          'arena.scenarios.bat_adv_02.s1_opt_1',
          'arena.scenarios.bat_adv_02.s1_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_adv_02.s1_explanation',
      },
      {
        stageNumber: 2,
        titleKey: 'arena.scenarios.bat_adv_02.s2_title',
        questionKey: 'arena.scenarios.bat_adv_02.s2_question',
        optionsKeys: [
          'arena.scenarios.bat_adv_02.s2_opt_0',
          'arena.scenarios.bat_adv_02.s2_opt_1',
          'arena.scenarios.bat_adv_02.s2_opt_2',
        ],
        correctChoice: 1,
        explanationKey: 'arena.scenarios.bat_adv_02.s2_explanation',
      },
    ],
  },
]

// Decorate scenarios with both camelCase and snake_case properties for maximum interoperability
export const ARENA_SCENARIOS = RAW_SCENARIOS.map((s) => ({
  ...s,
  title_key: s.titleKey,
  desc_key: s.descKey,
  xp_reward: s.xpReward,
  hint_key: s.hintKey,
  question_key: s.questionKey,
  options_keys: s.optionsKeys,
  correct_choice: s.correctChoice,
  explanation_key: s.explanationKey,
  badge_id: s.badgeId,
  synthetic_telemetry: [s.telemetryContent],
  stages: Array.isArray(s.stages)
    ? s.stages.map((stg) => ({
        ...stg,
        stage_number: stg.stageNumber,
        title_key: stg.titleKey,
        question_key: stg.questionKey,
        options_keys: stg.optionsKeys,
        correct_choice: stg.correctChoice,
        explanation_key: stg.explanationKey,
      }))
    : undefined,
}))

/**
 * Filter scenarios by mode and difficulty.
 */
export function getArenaScenarios(mode = 'all', difficulty = 'all') {
  return ARENA_SCENARIOS.filter((s) => {
    const matchMode = mode === 'all' || s.mode === mode
    const matchDiff = difficulty === 'all' || s.difficulty === difficulty
    return matchMode && matchDiff
  })
}

export function getArenaScenarioById(id) {
  if (!id) return null
  return ARENA_SCENARIOS.find(
    (s) => s.id === id || s.id === `arena_${id}` || s.id.replace(/^arena_/, '') === id
  ) || null
}

/**
 * Read current Arena progress from Journey storage (single source of truth).
 */
export function getArenaProgress() {
  const p = getJourneyProgress()
  const arena = (p && typeof p.arena === 'object' && p.arena !== null) ? p.arena : {}
  const completedScenarios = (typeof arena.completedScenarios === 'object' && arena.completedScenarios !== null)
    ? arena.completedScenarios
    : {}

  // Deduplicate by canonical ID
  const canonicalMap = new Map()
  for (const [key, val] of Object.entries(completedScenarios)) {
    if (!val || val.completed === false) continue
    const s = getArenaScenarioById(key)
    const canId = s ? s.id : key
    if (!canonicalMap.has(canId)) {
      canonicalMap.set(canId, { val, s })
    }
  }

  let beginnerCount = 0
  let intermediateCount = 0
  let advancedCount = 0
  let totalScore = 0
  let totalArenaXp = 0

  for (const [, { val, s }] of canonicalMap.entries()) {
    const diff = val.difficulty || (s ? s.difficulty : null)
    if (diff === 'beginner') beginnerCount++
    if (diff === 'intermediate') intermediateCount++
    if (diff === 'advanced') advancedCount++

    totalScore += typeof val.score === 'number' ? val.score : 100
    totalArenaXp += typeof val.xpAwarded === 'number'
      ? val.xpAwarded
      : (typeof val.xpEarned === 'number' ? val.xpEarned : (s ? s.xpReward : 50))
  }

  const unlockedTiers = ['beginner']
  if (beginnerCount >= TIER_UNLOCK_THRESHOLDS.intermediate) {
    unlockedTiers.push('intermediate')
  }
  if (intermediateCount >= TIER_UNLOCK_THRESHOLDS.advanced) {
    unlockedTiers.push('advanced')
  }

  const completedCount = canonicalMap.size

  return {
    completedScenarios,
    unlockedTiers,
    completedCount,
    totalScore,
    totalArenaXp,
    beginnerCompleted: beginnerCount,
    intermediateCompleted: intermediateCount,
    advancedCompleted: advancedCount,
  }
}

/**
 * Save / update arena progress in Journey storage.
 */
export function saveArenaProgress(arenaData = {}) {
  const currentJourney = getJourneyProgress()
  const updatedJourney = {
    ...currentJourney,
    arena: {
      ...(currentJourney.arena || {}),
      ...arenaData,
    },
  }
  saveJourneyProgress(updatedJourney)
  return getArenaProgress()
}

/**
 * Reset arena progress for tests or guest reset.
 */
export function resetArenaProgress() {
  const currentJourney = getJourneyProgress()
  const updatedJourney = {
    ...currentJourney,
    arena: {
      completedScenarios: {},
      unlockedTiers: ['beginner'],
      totalScore: 0,
      totalArenaXp: 0,
    },
  }
  saveJourneyProgress(updatedJourney)
  return getArenaProgress()
}

/**
 * Check if a difficulty tier is unlocked.
 */
export function isTierUnlocked(tier, arenaProgress = null) {
  if (tier === 'beginner') return true
  const prog = arenaProgress || getArenaProgress()
  return prog.unlockedTiers.includes(tier)
}

/**
 * Record an arena scenario completion with strict idempotency and anti-duplicate XP.
 * Supports both call styles:
 *   recordArenaScenarioCompleted('att_beg_01', { score: 100 })
 *   recordArenaScenarioCompleted({ scenarioId: 'att_beg_01', score: 100, answers, user })
 */
export async function recordArenaScenarioCompleted(param1, param2 = {}) {
  let scenarioId
  let score = 100
  let answers = {}
  let user = null

  if (typeof param1 === 'string') {
    scenarioId = param1
    if (param2 && typeof param2 === 'object') {
      if (typeof param2.score === 'number') score = param2.score
      if (param2.answers) answers = param2.answers
      if (param2.user) user = param2.user
    }
  } else if (param1 && typeof param1 === 'object') {
    scenarioId = param1.scenarioId
    if (typeof param1.score === 'number') score = param1.score
    if (param1.answers) answers = param1.answers
    if (param1.user) user = param1.user
  }

  const scenario = getArenaScenarioById(scenarioId)
  if (!scenario) {
    return { success: false, error: 'SCENARIO_NOT_FOUND', xpAwarded: 0, alreadyCompleted: false }
  }

  const canonicalId = scenario.id
  const currentJourney = getJourneyProgress()
  const currentArena = (currentJourney.arena && typeof currentJourney.arena === 'object')
    ? currentJourney.arena
    : {}
  const completedScenarios = { ...(currentArena.completedScenarios || {}) }

  const alreadyCompleted = Boolean(
    (completedScenarios[canonicalId] && completedScenarios[canonicalId].completed !== false) ||
    (scenarioId && completedScenarios[scenarioId] && completedScenarios[scenarioId].completed !== false)
  )

  const xpAwarded = alreadyCompleted ? 0 : scenario.xpReward
  const now = new Date().toISOString()

  // Update scenario completion record
  const record = {
    completed: true,
    scenarioId: canonicalId,
    mode: scenario.mode,
    difficulty: scenario.difficulty,
    score: typeof score === 'number' ? score : 100,
    xpAwarded: alreadyCompleted
      ? (completedScenarios[canonicalId]?.xpAwarded || completedScenarios[scenarioId]?.xpAwarded || 0)
      : xpAwarded,
    answers,
    completedAt: completedScenarios[canonicalId]?.completedAt || completedScenarios[scenarioId]?.completedAt || now,
    updatedAt: now,
  }

  completedScenarios[canonicalId] = record

  // Determine unlocked tiers
  let beginnerCount = 0
  let intermediateCount = 0
  for (const [key, val] of Object.entries(completedScenarios)) {
    if (!val || val.completed === false) continue
    const s = getArenaScenarioById(key)
    const diff = val.difficulty || (s ? s.difficulty : null)
    if (diff === 'beginner') beginnerCount++
    if (diff === 'intermediate') intermediateCount++
  }

  const unlockedTiers = ['beginner']
  if (beginnerCount >= TIER_UNLOCK_THRESHOLDS.intermediate) unlockedTiers.push('intermediate')
  if (intermediateCount >= TIER_UNLOCK_THRESHOLDS.advanced) unlockedTiers.push('advanced')

  // Award relevant badges
  const currentBadges = Array.isArray(currentJourney.badges) ? [...currentJourney.badges] : []
  let newBadge = null

  if (scenario.mode === 'attack' && !currentBadges.includes('badge_threat_spotter')) {
    currentBadges.push('badge_threat_spotter')
    newBadge = 'badge_threat_spotter'
  }
  if (scenario.mode === 'defense' && !currentBadges.includes('badge_defense_specialist')) {
    currentBadges.push('badge_defense_specialist')
    newBadge = 'badge_defense_specialist'
  }
  if (scenario.mode === 'battle' && !currentBadges.includes('badge_battle_strategist')) {
    currentBadges.push('badge_battle_strategist')
    newBadge = 'badge_battle_strategist'
  }
  if (scenario.difficulty === 'advanced' && !currentBadges.includes('badge_arena_master')) {
    currentBadges.push('badge_arena_master')
    newBadge = 'badge_arena_master'
  }

  // Award grandmaster badge if all scenarios completed
  const allMastered = Object.values(completedScenarios).filter((v) => v && v.completed !== false).length >= ARENA_SCENARIOS.length
  if (allMastered && !currentBadges.includes('badge_arena_grandmaster')) {
    currentBadges.push('badge_arena_grandmaster')
    newBadge = 'badge_arena_grandmaster'
  }

  const updatedArena = {
    ...currentArena,
    completedScenarios,
    unlockedTiers,
    updatedAt: now,
  }

  const updatedJourney = {
    ...currentJourney,
    arena: updatedArena,
    totalXp: (currentJourney.totalXp || 0) + xpAwarded,
    badges: currentBadges,
    updatedAt: now,
  }

  saveJourneyProgress(updatedJourney)

  // Cloud sync if authenticated and enabled
  if (user?.preferences?.cloud_progress_sync_enabled) {
    try {
      const activeLvl = unlockedTiers.includes('advanced') ? 3 : (unlockedTiers.includes('intermediate') ? 2 : 1)
      await saveProgress({
        activeLevel: activeLvl,
        unlockedLevels: unlockedTiers,
        completedLevels: completedScenarios,
      })
    } catch {
      // Offline fallback: progress safely preserved locally
    }
  }

  // Queue in Notification Center (non-blocking)
  const accountId = user ? user.id : 'guest'
  try {
    const cached = await getCachedNotifications(accountId)
    const newNotifs = []

    // Completion notification
    const alreadyNotified = cached.some(
      (n) => n.data?.category === 'arena' && (n.data?.scenario_id === canonicalId || n.data?.scenario_id === scenarioId)
    )
    if (!alreadyNotified) {
      newNotifs.push({
        id: `arena_${canonicalId}_${Date.now()}`,
        account_id: accountId,
        type: 'challenge',
        title_key: 'notif.arena_completed_title',
        message_key: 'notif.arena_completed_msg',
        data: { category: 'arena', scenario_id: canonicalId, xp: xpAwarded, destination: 'arena' },
        is_read: false,
        created_at: now,
        is_local_only: !user,
      })
    }

    // Badge unlocked notification
    if (newBadge) {
      const badgeNotified = cached.some(
        (n) => n.type === 'progress' && n.data?.badge_id === newBadge
      )
      if (!badgeNotified) {
        newNotifs.push({
          id: `badge_${newBadge}_${Date.now()}`,
          account_id: accountId,
          type: 'progress',
          title_key: 'notif.badge_earned_title',
          message_key: 'notif.badge_earned_msg',
          data: { badge_id: newBadge, destination: 'arena' },
          is_read: false,
          created_at: now,
          is_local_only: !user,
        })
      }
    }

    if (newNotifs.length > 0) {
      await saveCachedNotifications(accountId, newNotifs)
    }
  } catch {
    // Non-blocking notification recording
  }

  return {
    success: true,
    xpAwarded,
    alreadyCompleted,
    newBadge,
    unlockedTiers,
    currentProgress: getArenaProgress(),
  }
}

/**
 * Find the next uncompleted scenario within currently unlocked tiers.
 */
export function getNextUncompletedScenario(arenaProgress = null) {
  const prog = arenaProgress || getArenaProgress()
  const completed = prog.completedScenarios || {}
  for (const scenario of ARENA_SCENARIOS) {
    if (!completed[scenario.id]?.completed && isTierUnlocked(scenario.difficulty, prog)) {
      return scenario
    }
  }
  return null
}

/**
 * Adaptive recommendation for Arena training.
 */
export function getRecommendedArenaScenario(arenaProgress = null) {
  const prog = arenaProgress || getArenaProgress()
  const next = getNextUncompletedScenario(prog)
  if (next) return next
  // If all completed, return first advanced scenario for mastery refresh
  return ARENA_SCENARIOS.find((s) => s.difficulty === 'advanced') || ARENA_SCENARIOS[0]
}
