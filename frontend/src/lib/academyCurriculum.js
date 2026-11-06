/**
 * ABBAY CYBERGUARD — ABBAY CYBER ACADEMY
 * Comprehensive Multi-Stage Curriculum Architecture (Levels 1 to 16+)
 *
 * Stage 1: Beginner to Strategic Defense (Levels 1–6) — Active & fully playable (32 questions)
 * Stage 2: Professional Cyber Defense (Levels 7–10) — Operational & applied security
 * Stage 3: Advanced Security Engineering (Levels 11–15) — Technical engineering & architecture
 * Stage 4: Continuing Mastery & Specialization (Level 16+) — Specialization paths & capstone
 */

export const ACADEMY_STAGES = [
  {
    id: 'stage_1',
    levelRange: '1–6',
    titleKey: 'academy.stage1.title',
    titleDefault: 'Stage 1: Essential Awareness to Strategic Defense',
    descKey: 'academy.stage1.desc',
    descDefault: 'Master foundational cybersecurity, threat recognition, privacy, incident response, and defensive website architecture.',
    badge: '🛡️',
    status: 'active',
  },
  {
    id: 'stage_2',
    levelRange: '7–10',
    titleKey: 'academy.stage2.title',
    titleDefault: 'Stage 2: Professional Cyber Defense',
    descKey: 'academy.stage2.desc',
    descDefault: 'Applied defensive operations, telemetry monitoring, incident triage, and bastion administration.',
    badge: '⚔️',
    status: 'curriculum_defined',
  },
  {
    id: 'stage_3',
    levelRange: '11–15',
    titleKey: 'academy.stage3.title',
    titleDefault: 'Stage 3: Advanced Security Engineering',
    descKey: 'academy.stage3.desc',
    descDefault: 'Deep technical software security, API defense, identity architecture (Zero Trust), and cryptographic engineering.',
    badge: '🏛️',
    status: 'curriculum_defined',
  },
  {
    id: 'stage_4',
    levelRange: '16+',
    titleKey: 'academy.stage4.title',
    titleDefault: 'Stage 4: Continuing Mastery & Specialization',
    descKey: 'academy.stage4.desc',
    descDefault: 'Specialized tracks (Incident Commander, Cloud Architect, Threat Intel), case studies, and capstone projects.',
    badge: '⭐',
    status: 'curriculum_defined',
  },
]

export const ACADEMY_LEVELS = [
  // =========================================================================
  // STAGE 1: FOUNDATION TO STRATEGIC DEFENSE (LEVELS 1–6) - ACTIVE PLAYABLE
  // =========================================================================
  {
    id: 'lvl1',
    num: 1,
    stageId: 'stage_1',
    titleKey: 'learn.lvl1.title',
    titleDefault: 'Beginner — Essential Awareness',
    descKey: 'learn.lvl1.desc',
    descDefault: 'Core digital threats: phishing links, strong passwords, privacy, basic reporting, and website trust.',
    icon: '🟢',
    questionCount: 7,
    passThreshold: 80,
    requiredTopics: ['phishing', 'password', 'privacy', 'response', 'website'],
    objectives: [
      'Identify basic phishing links and suspicious sender addresses.',
      'Understand password strength, passphrase length, and uniqueness.',
      'Recognize sensitive personal identifiable information (PII).',
      'Know the primary hotlines in Ethiopia (Ethio Telecom 994, Telebirr 127).',
    ],
    practicalExerciseId: 'sim_phish_01',
    certificateEligible: true,
    certificateTitle: 'Cyber Awareness Recruit Certificate',
  },
  {
    id: 'lvl2',
    num: 2,
    stageId: 'stage_1',
    titleKey: 'learn.lvl2.title',
    titleDefault: 'Foundation — Practical Threat Recognition',
    descKey: 'learn.lvl2.desc',
    descDefault: 'Threat recognition, Ethiopian mobile banking fraud, deceptive SMS alerts, and safe habits.',
    icon: '🔵',
    questionCount: 5,
    passThreshold: 80,
    requiredTopics: ['phishing', 'password', 'privacy', 'response', 'website'],
    objectives: [
      'Detect deceptive SMS messages impersonating Telebirr or CBE Birr.',
      'Apply Multi-Factor Authentication (MFA) and protect OTP/PIN codes.',
      'Recognize social engineering pretexting via phone calls (vishing).',
      'Verify websites using TLS certificate indicators without false trust.',
    ],
    practicalExerciseId: 'sim_social_01',
    certificateEligible: false,
  },
  {
    id: 'lvl3',
    num: 3,
    stageId: 'stage_1',
    titleKey: 'learn.lvl3.title',
    titleDefault: 'Intermediate — Scenario Analysis & Response',
    descKey: 'learn.lvl3.desc',
    descDefault: 'Multi-step scenario analysis, deceptive domains, credential harvesting, and incident containment.',
    icon: '🟣',
    questionCount: 5,
    passThreshold: 80,
    requiredTopics: ['phishing', 'password', 'privacy', 'response', 'website'],
    objectives: [
      'Analyze deceptive domain homographs and look-alike URLs.',
      'Differentiate between suspicious anomalies and confirmed compromises.',
      'Execute proper containment (session revoke, credential reset) after clicking links.',
      'Understand how HTTP Strict Transport Security (HSTS) prevents SSL stripping.',
    ],
    practicalExerciseId: 'sim_password_01',
    certificateEligible: true,
    certificateTitle: 'Intermediate Cyber Defender Certificate',
  },
  {
    id: 'lvl4',
    num: 4,
    stageId: 'stage_1',
    titleKey: 'learn.lvl4.title',
    titleDefault: 'Advanced Awareness — Multi-step Decisions',
    descKey: 'learn.lvl4.desc',
    descDefault: 'Complex social engineering, spear-phishing, SIM-swap indicators, and evidence preservation.',
    icon: '🟠',
    questionCount: 5,
    passThreshold: 80,
    requiredTopics: ['phishing', 'password', 'privacy', 'response', 'website'],
    objectives: [
      'Detect spear-phishing tailored with public event or organizational details.',
      'Identify SIM-swap fraud early and contact Ethio Telecom via 994 immediately.',
      'Preserve digital evidence (headers, transaction IDs, screenshots) safely.',
      'Evaluate defensive HTTP security headers (CSP, Permissions-Policy).',
    ],
    practicalExerciseId: 'sim_incident_01',
    certificateEligible: false,
  },
  {
    id: 'lvl5',
    num: 5,
    stageId: 'stage_1',
    titleKey: 'learn.lvl5.title',
    titleDefault: 'Continuing Mastery — Complex Threat Chains',
    descKey: 'learn.lvl5.desc',
    descDefault: 'Advanced threat chains, session hijacking, credential stuffing defenses, and recovery.',
    icon: '🔴',
    questionCount: 5,
    passThreshold: 80,
    requiredTopics: ['phishing', 'password', 'privacy', 'response', 'website'],
    objectives: [
      'Trace full attack chains from initial reconnaissance to account takeover.',
      'Enforce cookie security attributes (Secure, HttpOnly, SameSite=Strict).',
      'Defend against automated credential stuffing with rate limiting and MFA.',
      'Coordinate institutional incident reporting to Ethio-CERT and banks.',
    ],
    practicalExerciseId: 'sim_phish_01',
    certificateEligible: false,
  },
  {
    id: 'lvl6',
    num: 6,
    stageId: 'stage_1',
    titleKey: 'learn.lvl6.title',
    titleDefault: 'Strategic Cyber Defense — Architecture & Resilience',
    descKey: 'learn.lvl6.desc',
    descDefault: 'Architectural defense, defense-in-depth, security headers, and organizational resilience.',
    icon: '⭐',
    questionCount: 5,
    passThreshold: 80,
    requiredTopics: ['phishing', 'password', 'privacy', 'response', 'website'],
    objectives: [
      'Design defense-in-depth across endpoints, identity, network, and applications.',
      'Configure production web servers with hardened headers (Nginx/Apache).',
      'Implement zero-trust identity verification principles.',
      'Formulate post-incident lessons learned and preventive hardening roadmaps.',
    ],
    practicalExerciseId: 'sim_incident_01',
    certificateEligible: true,
    certificateTitle: 'Master Cyber Defender Certificate (Academy Graduate)',
  },

  // =========================================================================
  // STAGE 2: PROFESSIONAL CYBER DEFENSE (LEVELS 7–10) - CURRICULUM DEFINED
  // =========================================================================
  {
    id: 'lvl7',
    num: 7,
    stageId: 'stage_2',
    titleKey: 'academy.lvl7.title',
    titleDefault: 'Level 7: Defensive Telemetry & Log Monitoring',
    descKey: 'academy.lvl7.desc',
    descDefault: 'Security log ingestion, auth anomaly detection, event correlation, and defensive telemetry.',
    icon: '📊',
    passThreshold: 80,
    prerequisites: ['lvl6'],
    objectives: [
      'Understand centralized syslog, auth.log, and Windows Event Security logging.',
      'Detect brute-force authentication spikes and abnormal geographic logins.',
      'Filter noise and identify genuine indicator of compromise (IoC) telemetry.',
    ],
    practicalWork: 'Simulated SIEM log search & anomaly classification exercise.',
    completionOutcomes: 'Ability to read authentication logs and flag automated attacks.',
    certificateEligible: false,
  },
  {
    id: 'lvl8',
    num: 8,
    stageId: 'stage_2',
    titleKey: 'academy.lvl8.title',
    titleDefault: 'Level 8: Security Incident Analysis & Triage',
    descKey: 'academy.lvl8.desc',
    descDefault: 'Triage methodology, memory/disk containment, chain of custody, and forensic evidence collection.',
    icon: '🔬',
    passThreshold: 80,
    prerequisites: ['lvl7'],
    objectives: [
      'Perform rapid severity triage (P1 Critical vs P4 Informational).',
      'Isolate compromised hosts from networks without destroying volatile RAM artifacts.',
      'Document tamper-proof evidence records with SHA-256 hashes.',
    ],
    practicalWork: 'Ransomware outbreak containment and triage decision tree.',
    completionOutcomes: 'Ability to lead initial technical containment on an affected endpoint.',
    certificateEligible: false,
  },
  {
    id: 'lvl9',
    num: 9,
    stageId: 'stage_2',
    titleKey: 'academy.lvl9.title',
    titleDefault: 'Level 9: Hardened System & Bastion Administration',
    descKey: 'academy.lvl9.desc',
    descDefault: 'OS hardening (Linux CIS benchmarks, Windows GPO), SSH bastions, and least-privilege RBAC.',
    icon: '💻',
    passThreshold: 80,
    prerequisites: ['lvl8'],
    objectives: [
      'Apply CIS benchmark principles to Linux and Windows workstations.',
      'Enforce SSH key-only auth, disable root login, and configure jump-box bastions.',
      'Remove unnecessary software packages and suppress version banners.',
    ],
    practicalWork: 'Audit an insecure SSH/server configuration and generate hardening script.',
    completionOutcomes: 'Ability to harden production servers against unauthorized access.',
    certificateEligible: false,
  },
  {
    id: 'lvl10',
    num: 10,
    stageId: 'stage_2',
    titleKey: 'academy.lvl10.title',
    titleDefault: 'Level 10: Network Edge Defense & Perimeter Firewalls',
    descKey: 'academy.lvl10.desc',
    descDefault: 'Stateful packet inspection, ingress/egress filtering, DMZ segmentation, and IDS/IPS.',
    icon: '🌐',
    passThreshold: 80,
    prerequisites: ['lvl9'],
    objectives: [
      'Configure ingress and egress firewall rules rejecting unexpected outbound tunnels.',
      'Segment internal networks into isolated VLANs (Corporate vs Guest vs Payments).',
      'Understand signature vs anomaly-based Intrusion Detection Systems (IDS).',
    ],
    practicalWork: 'Design network ACLs for a banking payment gateway enclave.',
    completionOutcomes: 'Ability to design and inspect perimeter firewall rules.',
    certificateEligible: true,
    certificateTitle: 'Professional Cyber Defense Operations Certificate',
  },

  // =========================================================================
  // STAGE 3: ADVANCED SECURITY ENGINEERING (LEVELS 11–15)
  // =========================================================================
  {
    id: 'lvl11',
    num: 11,
    stageId: 'stage_3',
    titleKey: 'academy.lvl11.title',
    titleDefault: 'Level 11: Secure Software Engineering & Threat Modeling',
    descKey: 'academy.lvl11.desc',
    descDefault: 'STRIDE threat modeling, secure SDLC, safe parameterization, and input sanitization.',
    icon: '⚙️',
    passThreshold: 80,
    prerequisites: ['lvl10'],
    objectives: [
      'Conduct STRIDE threat modeling on application architecture diagrams.',
      'Eliminate SQL Injection and command injection via strict parameterized queries.',
      'Integrate static analysis (SAST) into automated CI/CD build pipelines.',
    ],
    practicalWork: 'Deconstruct a vulnerable code snippet and rewrite with prepared statements.',
    completionOutcomes: 'Ability to identify software vulnerabilities in source code before release.',
    certificateEligible: false,
  },
  {
    id: 'lvl12',
    num: 12,
    stageId: 'stage_3',
    titleKey: 'academy.lvl12.title',
    titleDefault: 'Level 12: Web Application Security & API Defense',
    descKey: 'academy.lvl12.desc',
    descDefault: 'OWASP Top 10, CSRF defense, CORS misconfigurations, and REST API rate limiting.',
    icon: '🔌',
    passThreshold: 80,
    prerequisites: ['lvl11'],
    objectives: [
      'Defend against Cross-Site Scripting (XSS) via context-aware output encoding and strict CSP.',
      'Configure CORS headers properly without dangerous wildcard reflections.',
      'Secure REST endpoints with JWT validation, token expiry, and token revocation lists.',
    ],
    practicalWork: 'Audit an API gateway specification for Broken Object Level Authorization (BOLA).',
    completionOutcomes: 'Ability to secure web services and REST APIs against web attacks.',
    certificateEligible: false,
  },
  {
    id: 'lvl13',
    num: 13,
    stageId: 'stage_3',
    titleKey: 'academy.lvl13.title',
    titleDefault: 'Level 13: Identity Architecture & Zero Trust',
    descKey: 'academy.lvl13.desc',
    descDefault: 'Zero Trust architecture, OAuth 2.0 PKCE, OpenID Connect, and continuous verification.',
    icon: '🔑',
    passThreshold: 80,
    prerequisites: ['lvl12'],
    objectives: [
      'Apply the core Zero Trust principle: "Never trust, always verify".',
      'Implement OAuth 2.0 Authorization Code Flow with PKCE for mobile and SPA clients.',
      'Deploy conditional access policies based on device compliance and risk score.',
    ],
    practicalWork: 'Architect an enterprise identity federation workflow with MFA step-up.',
    completionOutcomes: 'Ability to evaluate and architect modern identity security.',
    certificateEligible: false,
  },
  {
    id: 'lvl14',
    num: 14,
    stageId: 'stage_3',
    titleKey: 'academy.lvl14.title',
    titleDefault: 'Level 14: Cryptographic Engineering & Key Management',
    descKey: 'academy.lvl14.desc',
    descDefault: 'Symmetric/asymmetric algorithms, forward secrecy, KMS key rotation, and hash algorithms.',
    icon: '🔐',
    passThreshold: 80,
    prerequisites: ['lvl13'],
    objectives: [
      'Select approved cryptographic primitives (AES-GCM, ChaCha20-Poly1305, Ed25519).',
      'Understand password hashing functions (Argon2id, bcrypt, PBKDF2) vs fast hashes.',
      'Design secure cryptographic key management, envelope encryption, and HSM rotation.',
    ],
    practicalWork: 'Evaluate cryptographic cipher suites for enterprise TLS termination.',
    completionOutcomes: 'Ability to avoid cryptographic missteps in application architectures.',
    certificateEligible: false,
  },
  {
    id: 'lvl15',
    num: 15,
    stageId: 'stage_3',
    titleKey: 'academy.lvl15.title',
    titleDefault: 'Level 15: Enterprise Security Architecture & Risk Analysis',
    descKey: 'academy.lvl15.desc',
    descDefault: 'Risk assessment frameworks (NIST CSF, ISO 27001), threat modeling, and resilience planning.',
    icon: '🏛️',
    passThreshold: 80,
    prerequisites: ['lvl14'],
    objectives: [
      'Perform quantitative and qualitative cyber risk assessments for organizations.',
      'Map defensive posture to the NIST Cybersecurity Framework (Identify, Protect, Detect, Respond, Recover).',
      'Formulate disaster recovery and business continuity plans for ransomware scenarios.',
    ],
    practicalWork: 'Create an executive risk register and remediation budget proposal.',
    completionOutcomes: 'Ability to guide executive security decisions and architectural roadmaps.',
    certificateEligible: true,
    certificateTitle: 'Advanced Security Engineering & Architecture Certificate',
  },

  // =========================================================================
  // STAGE 4: CONTINUING MASTERY & SPECIALIZATION (LEVEL 16+)
  // =========================================================================
  {
    id: 'lvl16',
    num: 16,
    stageId: 'stage_4',
    titleKey: 'academy.lvl16.title',
    titleDefault: 'Level 16+: Continuing Mastery & Defensive Specialization Tracks',
    descKey: 'academy.lvl16.desc',
    descDefault: 'Specialized defensive tracks, live case studies, threat intelligence, and capstone evaluation.',
    icon: '🎖️',
    passThreshold: 85,
    prerequisites: ['lvl15'],
    objectives: [
      'Choose a specialized pathway: Incident Commander, Cloud Defense Architect, or Threat Intel Specialist.',
      'Analyze complex nation-state attack telemetry and publish mitigation advisories.',
      'Complete the ABBAY CYBERGUARD Defensive Capstone Project.',
    ],
    specializationTracks: [
      { id: 'track_commander', name: 'Cyber Incident Commander', focus: 'Crisis leadership & operational recovery' },
      { id: 'track_cloud', name: 'Cloud Defense Architect', focus: 'AWS / Azure / GCP secure infrastructure' },
      { id: 'track_forensics', name: 'Forensics & Threat Intelligence', focus: 'Malware reverse triage & threat hunting' },
    ],
    practicalWork: 'Defensive Capstone Project: End-to-end organizational defense hardening.',
    completionOutcomes: 'Highest level of cybersecurity competence inside ABBAY CYBERGUARD.',
    certificateEligible: true,
    certificateTitle: 'Master Cyber Commander Capstone Diploma',
  },
]

/**
 * Returns curriculum metadata for a given level number.
 */
export function getLevelCurriculum(lvlNum) {
  const l = ACADEMY_LEVELS.find((item) => item.num === Number(lvlNum))
  if (!l) return null
  return {
    ...l,
    title: l.title || l.titleDefault || l.titleKey,
    desc: l.desc || l.descDefault || l.descKey,
    prerequisites: l.prerequisites || (l.num === 1 ? 'None (Foundational Entry Level)' : `Level ${l.num - 1}`),
    requiredPracticalChallenge: l.requiredPracticalChallenge || l.practicalWork || l.practicalExerciseId || 'Defensive Verification Lab',
    assessmentCriteria: l.assessmentCriteria || `Achieve >= ${l.passThreshold || 80}% on level assessment`,
    completionOutcome: l.completionOutcome || l.completionOutcomes || 'Demonstrated defensive proficiency',
  }
}

/**
 * Returns stage metadata by stage ID.
 */
export function getStageMetadata(stageId) {
  return ACADEMY_STAGES.find((s) => s.id === stageId) || null
}

/**
 * Determines whether a level is unlockable based on current unlocked levels.
 */
export function isLevelUnlocked(lvlNum, unlockedLevels = [1]) {
  return Array.isArray(unlockedLevels) && unlockedLevels.includes(Number(lvlNum))
}

