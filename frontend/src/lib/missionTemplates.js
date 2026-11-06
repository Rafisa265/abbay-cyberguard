/**
 * Cyber Hero Journey - Reviewed Mission Templates & Offline Generator
 * 
 * Provides:
 * 1. Reviewed core mission specifications (M01 - M04).
 * 2. Deterministic offline mission generator combining reviewed components,
 *    scenarios, evidence sets, and difficulty tiers.
 * 3. 100% offline, zero network dependencies, fully deterministic without PRNG (SR-09 compliant).
 */

import { validateMission } from './missionSchema.js'
import { getFallbackArtwork, SPECIFIC_MISSION_ARTWORK_MAP } from './artworkManager.js'

export const CORE_MISSIONS = [
  {
    id: 'm01',
    code: 'MISSION_01',
    category: 'phishing_advance_fee',
    difficulty: 'beginner',
    badge_id: 'badge_scholarship_shield',
    xp_reward: 100,
    artwork_url: '/images/journey/m01_scholarship_phishing.svg',
    artwork_alt_key: 'journey.m01.artwork_alt',
    title_key: 'journey.m01.title',
    subtitle_key: 'journey.m01.subtitle',
    briefing_label_key: 'journey.m01.briefing_label',
    story_key: 'journey.m01.story',
    decision_title_key: 'journey.m01.decision.title',
    decision_desc_key: 'journey.m01.decision.desc',
    channel_handle: '@Ethio_Scholarship_Simulated',
    sender_name_key: 'journey.simulated_sender',
    target_url: 'http://scholarship-ethiopia-simulated-demo.invalid/verify',
    evidence_items: [
      { id: 'handle', icon: '🏷️', title_key: 'journey.evidence.handle_title', desc_key: 'journey.evidence.handle' },
      { id: 'urgency', icon: '⏱️', title_key: 'journey.evidence.urgency_title', desc_key: 'journey.evidence.urgency' },
      { id: 'url', icon: '🔗', title_key: 'journey.evidence.url_title', desc_key: 'journey.evidence.url' },
      { id: 'fee', icon: '💸', title_key: 'journey.evidence.fee_title', desc_key: 'journey.evidence.fee' },
    ],
    choices: [
      { id: 'choice_pay_fee', icon: '💳', label_key: 'journey.choice.pay_fee', feedback_key: 'journey.outcome.defeat_pay', isCorrect: false, isTrap: true },
      { id: 'choice_enter_creds', icon: '📝', label_key: 'journey.choice.enter_creds', feedback_key: 'journey.outcome.defeat_creds', isCorrect: false, isTrap: true },
      { id: 'choice_forward_friends', icon: '📢', label_key: 'journey.choice.forward_friends', feedback_key: 'journey.outcome.defeat_forward', isCorrect: false, isTrap: true },
      { id: 'choice_verify_official', icon: '🛡️', label_key: 'journey.choice.verify_official', feedback_key: 'journey.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_verify_official',
    trap_choices: ['choice_pay_fee', 'choice_enter_creds', 'choice_forward_friends'],
    debrief_rules: ['journey.debrief.rule1', 'journey.debrief.rule2', 'journey.debrief.rule3'],
  },
  {
    id: 'm02',
    code: 'MISSION_02',
    category: 'credential_harvesting_telecom',
    difficulty: 'intermediate',
    badge_id: 'badge_telecom_guardian',
    xp_reward: 150,
    artwork_url: '/images/journey/m02_sim_upgrade.svg',
    artwork_alt_key: 'journey.m02.artwork_alt',
    title_key: 'journey.m02.title',
    subtitle_key: 'journey.m02.subtitle',
    briefing_label_key: 'journey.m02.briefing_label',
    story_key: 'journey.m02.story',
    decision_title_key: 'journey.m02.decision.title',
    decision_desc_key: 'journey.m02.decision.desc',
    channel_handle: 'SMS: +25191199XXXX (Simulated)',
    sender_name_key: 'journey.m02.simulated_sender',
    target_url: 'http://ethiotelecom-kyc-verify.example.net/sim',
    evidence_items: [
      { id: 'sender_number', icon: '📱', title_key: 'journey.m02.evidence.sender_title', desc_key: 'journey.m02.evidence.sender_desc' },
      { id: 'urgency_disconnect', icon: '⚠️', title_key: 'journey.m02.evidence.urgency_title', desc_key: 'journey.m02.evidence.urgency_desc' },
      { id: 'credential_pin', icon: '🔒', title_key: 'journey.m02.evidence.pin_title', desc_key: 'journey.m02.evidence.pin_desc' },
      { id: 'domain_lookalike', icon: '🌐', title_key: 'journey.m02.evidence.domain_title', desc_key: 'journey.m02.evidence.domain_desc' },
    ],
    choices: [
      { id: 'choice_m02_enter_pin', icon: '🔢', label_key: 'journey.m02.choice.enter_pin', feedback_key: 'journey.m02.outcome.defeat_pin', isCorrect: false, isTrap: true },
      { id: 'choice_m02_reply_sms', icon: '✉️', label_key: 'journey.m02.choice.reply_sms', feedback_key: 'journey.m02.outcome.defeat_sms', isCorrect: false, isTrap: true },
      { id: 'choice_m02_call_stranger', icon: '📞', label_key: 'journey.m02.choice.call_stranger', feedback_key: 'journey.m02.outcome.defeat_call', isCorrect: false, isTrap: true },
      { id: 'choice_m02_verify_telecom', icon: '🛡️', label_key: 'journey.m02.choice.verify_telecom', feedback_key: 'journey.m02.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_m02_verify_telecom',
    debrief_rules: ['journey.m02.debrief.rule1', 'journey.m02.debrief.rule2', 'journey.m02.debrief.rule3'],
  },
  {
    id: 'm03',
    code: 'MISSION_03',
    category: 'fake_banking_bot',
    difficulty: 'intermediate',
    badge_id: 'badge_banking_defender',
    xp_reward: 150,
    artwork_url: '/images/journey/m03_banking_bot.svg',
    artwork_alt_key: 'journey.m03.artwork_alt',
    title_key: 'journey.m03.title',
    subtitle_key: 'journey.m03.subtitle',
    briefing_label_key: 'journey.m03.briefing_label',
    story_key: 'journey.m03.story',
    decision_title_key: 'journey.m03.decision.title',
    decision_desc_key: 'journey.m03.decision.desc',
    channel_handle: '@CBE_Bonus_Rewards_Simulated_Bot',
    sender_name_key: 'journey.m03.simulated_sender',
    target_url: 'http://cbe-holiday-rewards.example.org/claim',
    evidence_items: [
      { id: 'too_good_promise', icon: '💰', title_key: 'journey.m03.evidence.promise_title', desc_key: 'journey.m03.evidence.promise_desc' },
      { id: 'unverified_bot', icon: '🤖', title_key: 'journey.m03.evidence.bot_title', desc_key: 'journey.m03.evidence.bot_desc' },
      { id: 'otp_demand', icon: '🔑', title_key: 'journey.m03.evidence.otp_title', desc_key: 'journey.m03.evidence.otp_desc' },
      { id: 'spoofed_identity', icon: '🏦', title_key: 'journey.m03.evidence.spoof_title', desc_key: 'journey.m03.evidence.spoof_desc' },
    ],
    choices: [
      { id: 'choice_m03_submit_otp', icon: '🔑', label_key: 'journey.m03.choice.submit_otp', feedback_key: 'journey.m03.outcome.defeat_otp', isCorrect: false, isTrap: true },
      { id: 'choice_m03_share_groups', icon: '📢', label_key: 'journey.m03.choice.share_groups', feedback_key: 'journey.m03.outcome.defeat_share', isCorrect: false, isTrap: true },
      { id: 'choice_m03_deposit_small', icon: '💸', label_key: 'journey.m03.choice.deposit_small', feedback_key: 'journey.m03.outcome.defeat_deposit', isCorrect: false, isTrap: true },
      { id: 'choice_m03_report_bot', icon: '🛡️', label_key: 'journey.m03.choice.report_bot', feedback_key: 'journey.m03.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_m03_report_bot',
    debrief_rules: ['journey.m03.debrief.rule1', 'journey.m03.debrief.rule2', 'journey.m03.debrief.rule3'],
  },
  {
    id: 'm04',
    code: 'MISSION_04',
    category: 'malicious_apk_telegram',
    difficulty: 'advanced',
    badge_id: 'badge_malware_sentinel',
    xp_reward: 200,
    artwork_url: '/images/journey/m04_malicious_apk.svg',
    artwork_alt_key: 'journey.m04.artwork_alt',
    title_key: 'journey.m04.title',
    subtitle_key: 'journey.m04.subtitle',
    briefing_label_key: 'journey.m04.briefing_label',
    story_key: 'journey.m04.story',
    decision_title_key: 'journey.m04.decision.title',
    decision_desc_key: 'journey.m04.decision.desc',
    channel_handle: 'Telegram: @EthioCareers_Recruiter_Fake',
    sender_name_key: 'journey.m04.simulated_sender',
    target_url: 'http://ethio-careers-portal.example.com/download.apk',
    evidence_items: [
      { id: 'unsolicited_offer', icon: '💼', title_key: 'journey.m04.evidence.offer_title', desc_key: 'journey.m04.evidence.offer_desc' },
      { id: 'apk_sideload', icon: '📦', title_key: 'journey.m04.evidence.apk_title', desc_key: 'journey.m04.evidence.apk_desc' },
      { id: 'danger_permissions', icon: '🚨', title_key: 'journey.m04.evidence.perm_title', desc_key: 'journey.m04.evidence.perm_desc' },
      { id: 'untrusted_server', icon: '🌐', title_key: 'journey.m04.evidence.server_title', desc_key: 'journey.m04.evidence.server_desc' },
    ],
    choices: [
      { id: 'choice_m04_install_apk', icon: '📥', label_key: 'journey.m04.choice.install_apk', feedback_key: 'journey.m04.outcome.defeat_install', isCorrect: false, isTrap: true },
      { id: 'choice_m04_disable_playprotect', icon: '🔓', label_key: 'journey.m04.choice.disable_playprotect', feedback_key: 'journey.m04.outcome.defeat_protect', isCorrect: false, isTrap: true },
      { id: 'choice_m04_forward_peers', icon: '👥', label_key: 'journey.m04.choice.forward_peers', feedback_key: 'journey.m04.outcome.defeat_peers', isCorrect: false, isTrap: true },
      { id: 'choice_m04_refuse_verify', icon: '🛡️', label_key: 'journey.m04.choice.refuse_verify', feedback_key: 'journey.m04.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_m04_refuse_verify',
    debrief_rules: ['journey.m04.debrief.rule1', 'journey.m04.debrief.rule2', 'journey.m04.debrief.rule3'],
  },
]

export const PRACTICE_TEMPLATES = [
  {
    id: 'p01',
    base_template_id: 'p01',
    code: 'PRACTICE_01',
    category: 'fake_job_offers',
    difficulty: 'beginner',
    badge_id: 'badge_adaptive_scout',
    xp_reward: 100,
    artwork_url: '/images/journey/p01_fake_job.svg',
    artwork_alt_key: 'journey.p01.artwork_alt',
    title_key: 'journey.p01.title',
    subtitle_key: 'journey.p01.subtitle',
    briefing_label_key: 'journey.p01.briefing_label',
    story_key: 'journey.p01.story',
    decision_title_key: 'journey.p01.decision.title',
    decision_desc_key: 'journey.p01.decision.desc',
    channel_handle: '@Ethio_Jobs_Assistant_Demo',
    sender_name_key: 'journey.p01.simulated_sender',
    target_url: 'http://jobs-hawassa-simulated.invalid/apply',
    evidence_items: [
      { id: 'unverified_recruiter', icon: '💼', title_key: 'journey.p01.evidence.sender_title', desc_key: 'journey.p01.evidence.sender_desc' },
      { id: 'upfront_fee', icon: '💸', title_key: 'journey.p01.evidence.fee_title', desc_key: 'journey.p01.evidence.fee_desc' },
      { id: 'time_pressure', icon: '⏱️', title_key: 'journey.p01.evidence.urgency_title', desc_key: 'journey.p01.evidence.urgency_desc' },
    ],
    choices: [
      { id: 'choice_p01_pay_fee', icon: '💳', label_key: 'journey.p01.choice.pay_fee', feedback_key: 'journey.p01.outcome.defeat_pay', isCorrect: false, isTrap: true },
      { id: 'choice_p01_send_id', icon: '🪪', label_key: 'journey.p01.choice.send_id', feedback_key: 'journey.p01.outcome.defeat_id', isCorrect: false, isTrap: true },
      { id: 'choice_p01_forward_group', icon: '📢', label_key: 'journey.p01.choice.forward_group', feedback_key: 'journey.p01.outcome.defeat_forward', isCorrect: false, isTrap: true },
      { id: 'choice_p01_verify_official', icon: '🛡️', label_key: 'journey.p01.choice.verify_official', feedback_key: 'journey.p01.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_p01_verify_official',
    trap_choices: ['choice_p01_pay_fee', 'choice_p01_send_id', 'choice_p01_forward_group'],
    debrief_rules: ['journey.p01.debrief.rule1', 'journey.p01.debrief.rule2', 'journey.p01.debrief.rule3'],
  },
  {
    id: 'p02',
    base_template_id: 'p02',
    code: 'PRACTICE_02',
    category: 'password_safety',
    difficulty: 'intermediate',
    badge_id: 'badge_adaptive_scout',
    xp_reward: 150,
    artwork_url: '/images/journey/p02_password_sync.svg',
    artwork_alt_key: 'journey.p02.artwork_alt',
    title_key: 'journey.p02.title',
    subtitle_key: 'journey.p02.subtitle',
    briefing_label_key: 'journey.p02.briefing_label',
    story_key: 'journey.p02.story',
    decision_title_key: 'journey.p02.decision.title',
    decision_desc_key: 'journey.p02.decision.desc',
    channel_handle: 'Email: it-support-sync@portal.invalid',
    sender_name_key: 'journey.p02.simulated_sender',
    target_url: 'http://student-portal-auth-sync.invalid/login',
    evidence_items: [
      { id: 'countdown_urgency', icon: '⏱️', title_key: 'journey.p02.evidence.urgency_title', desc_key: 'journey.p02.evidence.urgency_desc' },
      { id: 'portal_impersonation', icon: '🌐', title_key: 'journey.p02.evidence.domain_title', desc_key: 'journey.p02.evidence.domain_desc' },
      { id: 'credential_demand', icon: '🔒', title_key: 'journey.p02.evidence.auth_title', desc_key: 'journey.p02.evidence.auth_desc' },
    ],
    choices: [
      { id: 'choice_p02_enter_password', icon: '🔑', label_key: 'journey.p02.choice.enter_password', feedback_key: 'journey.p02.outcome.defeat_password', isCorrect: false, isTrap: true },
      { id: 'choice_p02_forward_friends', icon: '👥', label_key: 'journey.p02.choice.forward_friends', feedback_key: 'journey.p02.outcome.defeat_forward', isCorrect: false, isTrap: true },
      { id: 'choice_p02_reply_password', icon: '✉️', label_key: 'journey.p02.choice.reply_password', feedback_key: 'journey.p02.outcome.defeat_reply', isCorrect: false, isTrap: true },
      { id: 'choice_p02_check_official_portal', icon: '🛡️', label_key: 'journey.p02.choice.check_official_portal', feedback_key: 'journey.p02.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_p02_check_official_portal',
    trap_choices: ['choice_p02_enter_password', 'choice_p02_forward_friends', 'choice_p02_reply_password'],
    debrief_rules: ['journey.p02.debrief.rule1', 'journey.p02.debrief.rule2', 'journey.p02.debrief.rule3'],
  },
  {
    id: 'p03',
    base_template_id: 'p03',
    code: 'PRACTICE_03',
    category: 'suspicious_links',
    difficulty: 'beginner',
    badge_id: 'badge_adaptive_scout',
    xp_reward: 100,
    artwork_url: '/images/journey/p03_qr_phishing.svg',
    artwork_alt_key: 'journey.p03.artwork_alt',
    title_key: 'journey.p03.title',
    subtitle_key: 'journey.p03.subtitle',
    briefing_label_key: 'journey.p03.briefing_label',
    story_key: 'journey.p03.story',
    decision_title_key: 'journey.p03.decision.title',
    decision_desc_key: 'journey.p03.decision.desc',
    channel_handle: 'Flyer: Promo QR Code',
    sender_name_key: 'journey.p03.simulated_sender',
    target_url: 'http://free-ethio-data-package.invalid/claim',
    evidence_items: [
      { id: 'unrealistic_lure', icon: '🎁', title_key: 'journey.p03.evidence.lure_title', desc_key: 'journey.p03.evidence.lure_desc' },
      { id: 'unverified_qr_domain', icon: '📱', title_key: 'journey.p03.evidence.qr_title', desc_key: 'journey.p03.evidence.qr_desc' },
      { id: 'login_harvest', icon: '🪤', title_key: 'journey.p03.evidence.harvest_title', desc_key: 'journey.p03.evidence.harvest_desc' },
    ],
    choices: [
      { id: 'choice_p03_scan_login', icon: '📲', label_key: 'journey.p03.choice.scan_login', feedback_key: 'journey.p03.outcome.defeat_login', isCorrect: false, isTrap: true },
      { id: 'choice_p03_share_qr', icon: '📸', label_key: 'journey.p03.choice.share_qr', feedback_key: 'journey.p03.outcome.defeat_share', isCorrect: false, isTrap: true },
      { id: 'choice_p03_enter_phone_otp', icon: '🔢', label_key: 'journey.p03.choice.enter_phone_otp', feedback_key: 'journey.p03.outcome.defeat_otp', isCorrect: false, isTrap: true },
      { id: 'choice_p03_verify_provider', icon: '🛡️', label_key: 'journey.p03.choice.verify_provider', feedback_key: 'journey.p03.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_p03_verify_provider',
    trap_choices: ['choice_p03_scan_login', 'choice_p03_share_qr', 'choice_p03_enter_phone_otp'],
    debrief_rules: ['journey.p03.debrief.rule1', 'journey.p03.debrief.rule2', 'journey.p03.debrief.rule3'],
  },
  {
    id: 'p04',
    base_template_id: 'p04',
    code: 'PRACTICE_04',
    category: 'social_engineering',
    difficulty: 'advanced',
    badge_id: 'badge_adaptive_scout',
    xp_reward: 200,
    artwork_url: '/images/journey/p04_social_transfer.svg',
    artwork_alt_key: 'journey.p04.artwork_alt',
    title_key: 'journey.p04.title',
    subtitle_key: 'journey.p04.subtitle',
    briefing_label_key: 'journey.p04.briefing_label',
    story_key: 'journey.p04.story',
    decision_title_key: 'journey.p04.decision.title',
    decision_desc_key: 'journey.p04.decision.desc',
    channel_handle: 'SMS from: +25192233XXXX (Simulated)',
    sender_name_key: 'journey.p04.simulated_sender',
    target_url: 'http://mobile-transfer-verify.invalid/reversal',
    evidence_items: [
      { id: 'personal_sender_number', icon: '📱', title_key: 'journey.p04.evidence.sender_title', desc_key: 'journey.p04.evidence.sender_desc' },
      { id: 'emotional_pressure', icon: '😭', title_key: 'journey.p04.evidence.pressure_title', desc_key: 'journey.p04.evidence.pressure_desc' },
      { id: 'mismatched_recipient', icon: '🔄', title_key: 'journey.p04.evidence.mismatch_title', desc_key: 'journey.p04.evidence.mismatch_desc' },
    ],
    choices: [
      { id: 'choice_p04_refund_immediately', icon: '💸', label_key: 'journey.p04.choice.refund_immediately', feedback_key: 'journey.p04.outcome.defeat_refund', isCorrect: false, isTrap: true },
      { id: 'choice_p04_click_sms_link', icon: '🔗', label_key: 'journey.p04.choice.click_sms_link', feedback_key: 'journey.p04.outcome.defeat_link', isCorrect: false, isTrap: true },
      { id: 'choice_p04_share_caller_number', icon: '📢', label_key: 'journey.p04.choice.share_caller_number', feedback_key: 'journey.p04.outcome.defeat_share', isCorrect: false, isTrap: true },
      { id: 'choice_p04_verify_balance_official', icon: '🛡️', label_key: 'journey.p04.choice.verify_balance_official', feedback_key: 'journey.p04.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_p04_verify_balance_official',
    trap_choices: ['choice_p04_refund_immediately', 'choice_p04_click_sms_link', 'choice_p04_share_caller_number'],
    debrief_rules: ['journey.p04.debrief.rule1', 'journey.p04.debrief.rule2', 'journey.p04.debrief.rule3'],
  },
  {
    id: 'p05',
    base_template_id: 'p05',
    code: 'PRACTICE_05',
    category: 'privacy_incident_response',
    difficulty: 'intermediate',
    badge_id: 'badge_adaptive_scout',
    xp_reward: 150,
    artwork_url: '/images/journey/p05_data_leak.svg',
    artwork_alt_key: 'journey.p05.artwork_alt',
    title_key: 'journey.p05.title',
    subtitle_key: 'journey.p05.subtitle',
    briefing_label_key: 'journey.p05.briefing_label',
    story_key: 'journey.p05.story',
    decision_title_key: 'journey.p05.decision.title',
    decision_desc_key: 'journey.p05.decision.desc',
    channel_handle: '@Ethio_Leak_Monitor_Simulated',
    sender_name_key: 'journey.p05.simulated_sender',
    target_url: 'http://student-data-leak-lookup.invalid/search',
    evidence_items: [
      { id: 'secondary_harvesting', icon: '🪤', title_key: 'journey.p05.evidence.harvest_title', desc_key: 'journey.p05.evidence.harvest_desc' },
      { id: 'unverified_leak_channel', icon: '📢', title_key: 'journey.p05.evidence.channel_title', desc_key: 'journey.p05.evidence.channel_desc' },
      { id: 'sensitive_input_prompt', icon: '🔍', title_key: 'journey.p05.evidence.input_title', desc_key: 'journey.p05.evidence.input_desc' },
    ],
    choices: [
      { id: 'choice_p05_submit_lookup', icon: '📝', label_key: 'journey.p05.choice.submit_lookup', feedback_key: 'journey.p05.outcome.defeat_lookup', isCorrect: false, isTrap: true },
      { id: 'choice_p05_download_leak_csv', icon: '📥', label_key: 'journey.p05.choice.download_leak_csv', feedback_key: 'journey.p05.outcome.defeat_download', isCorrect: false, isTrap: true },
      { id: 'choice_p05_forward_channel', icon: '👥', label_key: 'journey.p05.choice.forward_channel', feedback_key: 'journey.p05.outcome.defeat_forward', isCorrect: false, isTrap: true },
      { id: 'choice_p05_draft_incident_report', icon: '🛡️', label_key: 'journey.p05.choice.draft_incident_report', feedback_key: 'journey.p05.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_p05_draft_incident_report',
    trap_choices: ['choice_p05_submit_lookup', 'choice_p05_download_leak_csv', 'choice_p05_forward_channel'],
    debrief_rules: ['journey.p05.debrief.rule1', 'journey.p05.debrief.rule2', 'journey.p05.debrief.rule3'],
  },
  {
    id: 'p06',
    base_template_id: 'p06',
    code: 'PRACTICE_06',
    category: 'malicious_apk_telegram',
    difficulty: 'advanced',
    badge_id: 'badge_adaptive_scout',
    xp_reward: 200,
    artwork_url: '/images/journey/p06_compromised_peer.svg',
    artwork_alt_key: 'journey.p06.artwork_alt',
    title_key: 'journey.p06.title',
    subtitle_key: 'journey.p06.subtitle',
    briefing_label_key: 'journey.p06.briefing_label',
    story_key: 'journey.p06.story',
    decision_title_key: 'journey.p06.decision.title',
    decision_desc_key: 'journey.p06.decision.desc',
    channel_handle: 'Telegram: @Compromised_Peer_Simulated',
    sender_name_key: 'journey.p06.simulated_sender',
    target_url: 'http://exam-prep-portal-ethiopia.invalid/ExamViewer.apk',
    evidence_items: [
      { id: 'compromised_account_indicator', icon: '👥', title_key: 'journey.p06.evidence.peer_title', desc_key: 'journey.p06.evidence.peer_desc' },
      { id: 'apk_sideload_bypass', icon: '📦', title_key: 'journey.p06.evidence.apk_title', desc_key: 'journey.p06.evidence.apk_desc' },
      { id: 'permission_demands', icon: '🚨', title_key: 'journey.p06.evidence.perm_title', desc_key: 'journey.p06.evidence.perm_desc' },
    ],
    choices: [
      { id: 'choice_p06_install_apk', icon: '📥', label_key: 'journey.p06.choice.install_apk', feedback_key: 'journey.p06.outcome.defeat_install', isCorrect: false, isTrap: true },
      { id: 'choice_p06_forward_classmates', icon: '📢', label_key: 'journey.p06.choice.forward_classmates', feedback_key: 'journey.p06.outcome.defeat_forward', isCorrect: false, isTrap: true },
      { id: 'choice_p06_disable_security', icon: '🔓', label_key: 'journey.p06.choice.disable_security', feedback_key: 'journey.p06.outcome.defeat_disable', isCorrect: false, isTrap: true },
      { id: 'choice_p06_verify_out_of_band', icon: '🛡️', label_key: 'journey.p06.choice.verify_out_of_band', feedback_key: 'journey.p06.outcome.victory_desc', isCorrect: true, isTrap: false },
    ],
    correct_choice: 'choice_p06_verify_out_of_band',
    trap_choices: ['choice_p06_install_apk', 'choice_p06_forward_classmates', 'choice_p06_disable_security'],
    debrief_rules: ['journey.p06.debrief.rule1', 'journey.p06.debrief.rule2', 'journey.p06.debrief.rule3'],
  },
]

export const PRACTICE_VARIATION_TEMPLATES = {
  p01: [
    {
      title_key: 'journey.p07.title',
      subtitle_key: 'journey.p07.subtitle',
      briefing_label_key: 'journey.p07.briefing_label',
      story_key: 'journey.p07.story',
      decision_title_key: 'journey.p07.decision.title',
      decision_desc_key: 'journey.p07.decision.desc',
      channel_handle: 'Security: Push Notification',
      sender_name_key: 'journey.p07.simulated_sender',
      target_url: 'https://auth.example.com/approve-sign-in',
      evidence_items: [
        { id: 'unprompted_push', icon: '🚨', title_key: 'journey.p07.evidence.push_title', desc_key: 'journey.p07.evidence.push_desc' },
        { id: 'foreign_location', icon: '🌐', title_key: 'journey.p07.evidence.location_title', desc_key: 'journey.p07.evidence.location_desc' },
        { id: 'mfa_fatigue', icon: '⏱️', title_key: 'journey.p07.evidence.fatigue_title', desc_key: 'journey.p07.evidence.fatigue_desc' },
      ],
      choices: [
        { id: 'choice_p07_approve', icon: '📱', label_key: 'journey.p07.choice.approve', feedback_key: 'journey.p07.outcome.defeat_approve', isCorrect: false, isTrap: true },
        { id: 'choice_p07_ignore', icon: '🔕', label_key: 'journey.p07.choice.ignore', feedback_key: 'journey.p07.outcome.defeat_ignore', isCorrect: false, isTrap: true },
        { id: 'choice_p07_share', icon: '📢', label_key: 'journey.p07.choice.share', feedback_key: 'journey.p07.outcome.defeat_share', isCorrect: false, isTrap: true },
        { id: 'choice_p07_deny_change_pw', icon: '🛡️', label_key: 'journey.p07.choice.deny_change_pw', feedback_key: 'journey.p07.outcome.victory_desc', isCorrect: true, isTrap: false },
      ],
      correct_choice: 'choice_p07_deny_change_pw',
      trap_choices: ['choice_p07_approve', 'choice_p07_ignore', 'choice_p07_share'],
      debrief_rules: ['journey.p07.debrief.rule1', 'journey.p07.debrief.rule2', 'journey.p07.debrief.rule3'],
    },
  ],
  p02: [
    {
      title_key: 'journey.p08.title',
      subtitle_key: 'journey.p08.subtitle',
      briefing_label_key: 'journey.p08.briefing_label',
      story_key: 'journey.p08.story',
      decision_title_key: 'journey.p08.decision.title',
      decision_desc_key: 'journey.p08.decision.desc',
      channel_handle: 'Forum: Account Alert',
      sender_name_key: 'journey.p08.simulated_sender',
      target_url: 'http://entertainment-forum-ethiopia.invalid/profile',
      evidence_items: [
        { id: 'credential_reuse', icon: '🔑', title_key: 'journey.p08.evidence.reuse_title', desc_key: 'journey.p08.evidence.reuse_desc' },
        { id: 'stuffing_threat', icon: '🪤', title_key: 'journey.p08.evidence.stuffing_title', desc_key: 'journey.p08.evidence.stuffing_desc' },
        { id: 'unencrypted_forum', icon: '⚠️', title_key: 'journey.p08.evidence.forum_title', desc_key: 'journey.p08.evidence.forum_desc' },
      ],
      choices: [
        { id: 'choice_p08_do_nothing', icon: '🤷', label_key: 'journey.p08.choice.do_nothing', feedback_key: 'journey.p08.outcome.defeat_do_nothing', isCorrect: false, isTrap: true },
        { id: 'choice_p08_delete_forum', icon: '🗑️', label_key: 'journey.p08.choice.delete_forum', feedback_key: 'journey.p08.outcome.defeat_delete_forum', isCorrect: false, isTrap: true },
        { id: 'choice_p08_change_forum_only', icon: '🔄', label_key: 'journey.p08.choice.change_forum_only', feedback_key: 'journey.p08.outcome.defeat_change_forum_only', isCorrect: false, isTrap: true },
        { id: 'choice_p08_unique_passwords', icon: '🛡️', label_key: 'journey.p08.choice.unique_passwords', feedback_key: 'journey.p08.outcome.victory_desc', isCorrect: true, isTrap: false },
      ],
      correct_choice: 'choice_p08_unique_passwords',
      trap_choices: ['choice_p08_do_nothing', 'choice_p08_delete_forum', 'choice_p08_change_forum_only'],
      debrief_rules: ['journey.p08.debrief.rule1', 'journey.p08.debrief.rule2', 'journey.p08.debrief.rule3'],
    },
  ],
  p03: [
    {
      title_key: 'journey.p09.title',
      subtitle_key: 'journey.p09.subtitle',
      briefing_label_key: 'journey.p09.briefing_label',
      story_key: 'journey.p09.story',
      decision_title_key: 'journey.p09.decision.title',
      decision_desc_key: 'journey.p09.decision.desc',
      channel_handle: 'SMS: Financial Notice',
      sender_name_key: 'journey.p09.simulated_sender',
      target_url: 'http://cbe-birr-verification.invalid/login',
      evidence_items: [
        { id: 'typosquat_domain', icon: '🌐', title_key: 'journey.p09.evidence.domain_title', desc_key: 'journey.p09.evidence.domain_desc' },
        { id: 'artificial_urgency', icon: '⏱️', title_key: 'journey.p09.evidence.urgency_title', desc_key: 'journey.p09.evidence.urgency_desc' },
        { id: 'pin_harvesting', icon: '🔒', title_key: 'journey.p09.evidence.harvest_title', desc_key: 'journey.p09.evidence.harvest_desc' },
      ],
      choices: [
        { id: 'choice_p09_click_update', icon: '🔗', label_key: 'journey.p09.choice.click_update', feedback_key: 'journey.p09.outcome.defeat_click_update', isCorrect: false, isTrap: true },
        { id: 'choice_p09_forward_family', icon: '👥', label_key: 'journey.p09.choice.forward_family', feedback_key: 'journey.p09.outcome.defeat_forward_family', isCorrect: false, isTrap: true },
        { id: 'choice_p09_reply_sms', icon: '✉️', label_key: 'journey.p09.choice.reply_sms', feedback_key: 'journey.p09.outcome.defeat_reply_sms', isCorrect: false, isTrap: true },
        { id: 'choice_p09_verify_official_app', icon: '🛡️', label_key: 'journey.p09.choice.verify_official_app', feedback_key: 'journey.p09.outcome.victory_desc', isCorrect: true, isTrap: false },
      ],
      correct_choice: 'choice_p09_verify_official_app',
      trap_choices: ['choice_p09_click_update', 'choice_p09_forward_family', 'choice_p09_reply_sms'],
      debrief_rules: ['journey.p09.debrief.rule1', 'journey.p09.debrief.rule2', 'journey.p09.debrief.rule3'],
    },
  ],
  p04: [
    {
      title_key: 'journey.p10.title',
      subtitle_key: 'journey.p10.subtitle',
      briefing_label_key: 'journey.p10.briefing_label',
      story_key: 'journey.p10.story',
      decision_title_key: 'journey.p10.decision.title',
      decision_desc_key: 'journey.p10.decision.desc',
      channel_handle: 'Voice Call: Telecom Support',
      sender_name_key: 'journey.p10.simulated_sender',
      target_url: 'http://telecom-sim-service.invalid/confirm-otp',
      evidence_items: [
        { id: 'otp_disclosure', icon: '🔢', title_key: 'journey.p10.evidence.otp_title', desc_key: 'journey.p10.evidence.otp_desc' },
        { id: 'disconnection_threat', icon: '📶', title_key: 'journey.p10.evidence.threat_title', desc_key: 'journey.p10.evidence.threat_desc' },
        { id: 'confidential_warning', icon: '🚨', title_key: 'journey.p10.evidence.warning_title', desc_key: 'journey.p10.evidence.warning_desc' },
      ],
      choices: [
        { id: 'choice_p10_read_otp', icon: '🗣️', label_key: 'journey.p10.choice.read_otp', feedback_key: 'journey.p10.outcome.defeat_read_otp', isCorrect: false, isTrap: true },
        { id: 'choice_p10_sms_back', icon: '📲', label_key: 'journey.p10.choice.sms_back', feedback_key: 'journey.p10.outcome.defeat_sms_back', isCorrect: false, isTrap: true },
        { id: 'choice_p10_ask_id', icon: '🪪', label_key: 'journey.p10.choice.ask_id', feedback_key: 'journey.p10.outcome.defeat_ask_id', isCorrect: false, isTrap: true },
        { id: 'choice_p10_refuse_hangup', icon: '🛡️', label_key: 'journey.p10.choice.refuse_hangup', feedback_key: 'journey.p10.outcome.victory_desc', isCorrect: true, isTrap: false },
      ],
      correct_choice: 'choice_p10_refuse_hangup',
      trap_choices: ['choice_p10_read_otp', 'choice_p10_sms_back', 'choice_p10_ask_id'],
      debrief_rules: ['journey.p10.debrief.rule1', 'journey.p10.debrief.rule2', 'journey.p10.debrief.rule3'],
    },
  ],
  p05: [
    {
      title_key: 'journey.p11.title',
      subtitle_key: 'journey.p11.subtitle',
      briefing_label_key: 'journey.p11.briefing_label',
      story_key: 'journey.p11.story',
      decision_title_key: 'journey.p11.decision.title',
      decision_desc_key: 'journey.p11.decision.desc',
      channel_handle: 'SMS: Payment Alert',
      sender_name_key: 'journey.p11.simulated_sender',
      target_url: 'http://mobile-payment-ethiopia.invalid/dispute',
      evidence_items: [
        { id: 'unauthorized_debit', icon: '💸', title_key: 'journey.p11.evidence.debit_title', desc_key: 'journey.p11.evidence.debit_desc' },
        { id: 'late_night_anomaly', icon: '🌙', title_key: 'journey.p11.evidence.night_title', desc_key: 'journey.p11.evidence.night_desc' },
        { id: 'active_session_risk', icon: '🚨', title_key: 'journey.p11.evidence.risk_title', desc_key: 'journey.p11.evidence.risk_desc' },
      ],
      choices: [
        { id: 'choice_p11_wait_morning', icon: '😴', label_key: 'journey.p11.choice.wait_morning', feedback_key: 'journey.p11.outcome.defeat_wait_morning', isCorrect: false, isTrap: true },
        { id: 'choice_p11_search_telegram', icon: '🤖', label_key: 'journey.p11.choice.search_telegram', feedback_key: 'journey.p11.outcome.defeat_search_telegram', isCorrect: false, isTrap: true },
        { id: 'choice_p11_delete_app', icon: '🗑️', label_key: 'journey.p11.choice.delete_app', feedback_key: 'journey.p11.outcome.defeat_delete_app', isCorrect: false, isTrap: true },
        { id: 'choice_p11_freeze_dispute', icon: '🛡️', label_key: 'journey.p11.choice.freeze_dispute', feedback_key: 'journey.p11.outcome.victory_desc', isCorrect: true, isTrap: false },
      ],
      correct_choice: 'choice_p11_freeze_dispute',
      trap_choices: ['choice_p11_wait_morning', 'choice_p11_search_telegram', 'choice_p11_delete_app'],
      debrief_rules: ['journey.p11.debrief.rule1', 'journey.p11.debrief.rule2', 'journey.p11.debrief.rule3'],
    },
  ],
  p06: [
    {
      title_key: 'journey.p12.title',
      subtitle_key: 'journey.p12.subtitle',
      briefing_label_key: 'journey.p12.briefing_label',
      story_key: 'journey.p12.story',
      decision_title_key: 'journey.p12.decision.title',
      decision_desc_key: 'journey.p12.decision.desc',
      channel_handle: 'Telegram: Sideloaded APK',
      sender_name_key: 'journey.p12.simulated_sender',
      target_url: 'http://telegram-theme-booster.invalid/download.apk',
      evidence_items: [
        { id: 'accessibility_abuse', icon: '🚨', title_key: 'journey.p12.evidence.accessibility_title', desc_key: 'journey.p12.evidence.accessibility_desc' },
        { id: 'unnecessary_permission', icon: '📦', title_key: 'journey.p12.evidence.permission_title', desc_key: 'journey.p12.evidence.permission_desc' },
        { id: 'sideloaded_origin', icon: '🌐', title_key: 'journey.p12.evidence.origin_title', desc_key: 'journey.p12.evidence.origin_desc' },
      ],
      choices: [
        { id: 'choice_p12_grant_permission', icon: '🔓', label_key: 'journey.p12.choice.grant_permission', feedback_key: 'journey.p12.outcome.defeat_grant_permission', isCorrect: false, isTrap: true },
        { id: 'choice_p12_grant_temporary', icon: '⏱️', label_key: 'journey.p12.choice.grant_temporary', feedback_key: 'journey.p12.outcome.defeat_grant_temporary', isCorrect: false, isTrap: true },
        { id: 'choice_p12_share_channel', icon: '📢', label_key: 'journey.p12.choice.share_channel', feedback_key: 'journey.p12.outcome.defeat_share_channel', isCorrect: false, isTrap: true },
        { id: 'choice_p12_deny_uninstall', icon: '🛡️', label_key: 'journey.p12.choice.deny_uninstall', feedback_key: 'journey.p12.outcome.victory_desc', isCorrect: true, isTrap: false },
      ],
      correct_choice: 'choice_p12_deny_uninstall',
      trap_choices: ['choice_p12_grant_permission', 'choice_p12_grant_temporary', 'choice_p12_share_channel'],
      debrief_rules: ['journey.p12.debrief.rule1', 'journey.p12.debrief.rule2', 'journey.p12.debrief.rule3'],
    },
  ],
}

/**
 * Resolves a practice template ID ('p01' - 'p06') from an ID string, object, or category.
 * Authoritative: checks base_template_id first.
 * Safely resolves legacy codes/IDs like MISSION_P5 -> p05, MISSION_P7 -> p01, MISSION_P9 -> p03.
 * Strictly avoids confusing campaign missions (M01 - M04) with practice templates.
 * 
 * @param {string|object} item
 * @returns {string|null} 'p01' - 'p06' or null
 */
export function resolvePracticeTemplateId(item) {
  if (!item) return null
  let id = ''
  let baseId = ''
  let code = ''
  let category = ''

  if (typeof item === 'string') {
    id = item.trim().toLowerCase()
  } else if (typeof item === 'object') {
    id = typeof item.id === 'string' ? item.id.trim().toLowerCase() : ''
    baseId = typeof item.base_template_id === 'string' ? item.base_template_id.trim().toLowerCase() : ''
    code = typeof item.code === 'string' ? item.code.trim().toLowerCase() : ''
    category = typeof item.category === 'string' ? item.category.trim().toLowerCase() : ''
  }

  // 1. Authoritative base template ID check (p01..p06, p1..p6, PRACTICE_01..PRACTICE_06, MISSION_P1..MISSION_P6)
  if (baseId) {
    const directMatch = baseId.match(/^p0?([1-6])$/i)
    if (directMatch) return 'p0' + directMatch[1]
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

  // 2. Campaign missions (m01 - m04) must NEVER be treated as practice templates
  if (/^m0[1-4]$/.test(id) || /^m0[1-4]$/.test(baseId)) {
    return null
  }

  // 3. Direct practice ID (p01..p06 or p1..p6)
  const directMatch = id.match(/^p0?([1-6])$/i)
  if (directMatch) {
    return 'p0' + directMatch[1]
  }

  // 4. Explicit code or ID matching legacy MISSION_P* or PRACTICE_* sequences
  const codeTarget = code || id
  const pCodeMatch = codeTarget.match(/(?:mission[_\-]?p|practice[_\-]?0?)([1-9][0-9]*)/i)
  if (pCodeMatch) {
    const num = parseInt(pCodeMatch[1], 10)
    if (num >= 1 && num <= 6) {
      return 'p0' + num
    }
    // In a 6-template rotation cycle, sequence index N maps to ((N - 1) % 6) + 1
    const rotated = ((num - 1) % 6) + 1
    return 'p0' + rotated
  }

  // 5. Embedded practice ID pattern (e.g., gen_m_p01_..., gen_p01, gen_m05, etc.)
  const pMatch = id.match(/(?:^|[^a-z0-9])p0?([1-6])(?:[^a-z0-9]|$)/i)
  if (pMatch) {
    return 'p0' + pMatch[1]
  }

  // Handle legacy generated practice IDs like gen_m05, gen_m_05, gen_m06
  const legacyGenMatch = id.match(/(?:^|[^a-z0-9])(?:gen_m_?0?|m0)([56])(?:[^a-z0-9]|$)/i)
  if (legacyGenMatch) {
    return 'p0' + legacyGenMatch[1]
  }

  // 6. Unique category matching for practice missions
  const catToCheck = (category || id).toLowerCase()
  if (catToCheck.includes('fake_job_offers') || catToCheck.includes('phish')) return 'p01'
  if (catToCheck.includes('password') || catToCheck.includes('credential')) return 'p02'
  if (catToCheck.includes('suspicious_links') || catToCheck.includes('qr') || catToCheck.includes('lure')) return 'p03'
  if (catToCheck.includes('social_eng') || catToCheck.includes('sim_swap') || catToCheck.includes('telecom') || catToCheck.includes('transfer')) return 'p04'
  if (catToCheck.includes('privacy_incident_response') || catToCheck.includes('banking') || catToCheck.includes('bot') || catToCheck.includes('leak')) return 'p05'
  if (catToCheck.includes('malicious_apk') || catToCheck.includes('malware')) return 'p06'

  return null
}

/**
 * Procedural offline adaptive mission generator.
 * Combines reviewed scenario structures with skill adaptation parameters.
 * 100% offline, deterministic without non-cryptographic PRNG (SR-09 compliant).
 * 
 * Strict Rotation Guarantee:
 * - Every one of the six practice templates (P01–P06) appears exactly once
 *   before any template can repeat in the rotation cycle.
 * - At a cycle boundary, immediately repeating the preceding template is avoided.
 * - Sourced strictly from reviewed practice templates (P01–P06); campaign missions never enter rotation.
 * 
 * @param {object} options
 * @param {number} [options.index=0] - Deterministic variation index
 * @param {'beginner'|'intermediate'|'advanced'} [options.difficulty=null]
 * @param {string|null} [options.category=null] - Target threat category
 * @param {Array<string|object>} [options.excludeIds=[]] - IDs or mission objects to avoid / track history
 * @returns {object} Validated mission object with authoritative base_template_id
 */
export function generateOfflineMission(options = {}) {
  const index = typeof options.index === 'number' ? Math.abs(options.index) : 0
  const requestedDifficulty = options.difficulty || null
  const requestedCategory = options.category || null
  const requestedTemplateId = options.templateId || options.baseTemplateId || options.base_template_id || null
  const excludeIds = Array.isArray(options.excludeIds) ? options.excludeIds : []

  // Candidate pool strictly from reviewed practice templates (not core campaign missions)
  const pool = [...PRACTICE_TEMPLATES]

  // Map excludeIds to valid practice template history (p01..p06), safely ignoring campaign missions
  const history = []
  excludeIds.forEach((item) => {
    const tid = resolvePracticeTemplateId(item)
    if (tid && tid.startsWith('p')) {
      history.push(tid.toLowerCase())
    }
  })

  // Explicit template request takes direct precedence
  let baseTemplate = null
  if (requestedTemplateId) {
    const tid = resolvePracticeTemplateId(requestedTemplateId)
    baseTemplate = pool.find((t) => t.id.toLowerCase() === tid) || null
  }

  if (!baseTemplate) {
    // Track rotation cycles of 6 distinct templates (P01–P06)
    let currentRotationSet = new Set()
    let lastTemplateId = null

    for (const tid of history) {
      if (currentRotationSet.size >= pool.length) {
        currentRotationSet = new Set([tid])
      } else {
        currentRotationSet.add(tid)
      }
      lastTemplateId = tid
    }

    // Determine available templates in current rotation cycle in authoritative pool order
    let isNewRotation = false
    let unusedInRotation = []

    if (currentRotationSet.size >= pool.length || history.length === 0) {
      isNewRotation = true
      unusedInRotation = [...pool]
    } else {
      unusedInRotation = pool.filter((t) => !currentRotationSet.has(t.id.toLowerCase()))
      if (unusedInRotation.length === 0) {
        isNewRotation = true
        unusedInRotation = [...pool]
      }
    }

    // In a new rotation, avoid consecutive duplicates with immediately preceding template
    let candidates = unusedInRotation
    if (isNewRotation && lastTemplateId) {
      const nonConsecutive = unusedInRotation.filter((t) => t.id.toLowerCase() !== lastTemplateId)
      if (nonConsecutive.length > 0) {
        candidates = nonConsecutive
      }
    }

    // Filter by requested category IF explicitly requested
    if (requestedCategory) {
      let catMatches = candidates.filter((t) => t.category === requestedCategory)
      if (catMatches.length === 0) {
        const tid = resolvePracticeTemplateId(requestedCategory)
        if (tid) {
          catMatches = candidates.filter((t) => t.id.toLowerCase() === tid)
        }
      }
      if (catMatches.length > 0) {
        candidates = catMatches
      }
    }

    // Filter by requested difficulty IF explicitly requested
    // If no unused template in current rotation matches difficulty, do not break rotation
    if (requestedDifficulty) {
      const diffMatches = candidates.filter((t) => t.difficulty === requestedDifficulty)
      if (diffMatches.length > 0) {
        candidates = diffMatches
      }
    }

    // Select the next base template in authoritative rotation order:
    // When following standard rotation (no category/difficulty filter), pick candidates[0]
    // which is the next unused template in the authoritative order (P01, P02, P03, P04, P05, P06).
    // If a filter matched multiple candidates, select deterministically via index.
    baseTemplate = (requestedCategory || requestedDifficulty)
      ? candidates[index % candidates.length]
      : candidates[0]
  }

  const baseId = baseTemplate.id.toLowerCase() // Authoritative 'p01' - 'p06'

  // Extract practice number (e.g. '01' - '12')
  const numMatch = baseTemplate.id.match(/p0?([1-9][0-9]*)/i)
  const practiceNum = numMatch ? numMatch[1].padStart(2, '0') : '01'

  // Generate deterministic instance ID separate from base template ID
  const occurrence = history.filter((tid) => tid === baseTemplate.id.toLowerCase()).length
  const uniqueInstanceId = occurrence === 0
    ? `gen_m_${baseTemplate.id.toLowerCase()}_${baseTemplate.category}`
    : `gen_m_${baseTemplate.id.toLowerCase()}_v${occurrence + 1}_${baseTemplate.category}`

  const missionCode = occurrence === 0
    ? `PRACTICE_${practiceNum}`
    : `PRACTICE_${practiceNum}_V${occurrence + 1}`

  const useVariation = options.useVariation || false
  const variationList = PRACTICE_VARIATION_TEMPLATES[baseId] || []
  const variation = (useVariation && occurrence > 0 && variationList.length > 0)
    ? variationList[(occurrence - 1) % variationList.length]
    : null

  const generated = {
    ...baseTemplate,
    id: uniqueInstanceId,
    code: missionCode,
    base_template_id: baseId, // Authoritative: 'p01' - 'p06'
    difficulty: baseTemplate.difficulty,
    xp_reward: baseTemplate.xp_reward,
    badge_id: baseTemplate.badge_id,
    title_key: variation?.title_key || baseTemplate.title_key,
    subtitle_key: variation?.subtitle_key || baseTemplate.subtitle_key,
    story_key: variation?.story_key || baseTemplate.story_key,
    briefing_label_key: variation?.briefing_label_key || baseTemplate.briefing_label_key,
    decision_title_key: variation?.decision_title_key || baseTemplate.decision_title_key,
    decision_desc_key: variation?.decision_desc_key || baseTemplate.decision_desc_key,
    channel_handle: variation?.channel_handle || baseTemplate.channel_handle,
    sender_name_key: variation?.sender_name_key || baseTemplate.sender_name_key,
    target_url: variation?.target_url || baseTemplate.target_url,
    evidence_items: variation?.evidence_items ? [...variation.evidence_items] : [...baseTemplate.evidence_items],
    choices: variation?.choices ? [...variation.choices] : [...baseTemplate.choices],
    correct_choice: variation?.correct_choice || baseTemplate.correct_choice,
    trap_choices: variation?.trap_choices ? [...variation.trap_choices] : [...baseTemplate.trap_choices],
    debrief_rules: variation?.debrief_rules ? [...variation.debrief_rules] : [...baseTemplate.debrief_rules],
    artwork_url: SPECIFIC_MISSION_ARTWORK_MAP[baseTemplate.id.toLowerCase()] || baseTemplate.artwork_url,
    artwork_alt_key: baseTemplate.artwork_alt_key || `journey.${baseTemplate.id.toLowerCase()}.artwork_alt`,
  }

  // Strict schema validation before returning
  const validation = validateMission(generated)
  if (!validation.valid) {
    const fallback = {
      ...baseTemplate,
      id: `gen_fallback_${uniqueInstanceId}`,
      code: missionCode,
      base_template_id: baseId,
      difficulty: baseTemplate.difficulty,
      xp_reward: baseTemplate.xp_reward,
    }
    const fallbackValidation = validateMission(fallback)
    if (fallbackValidation.valid) {
      return fallback
    }
    throw new Error(`Generated mission failed validation: ${validation.errors.join(', ')}`)
  }

  return generated
}


