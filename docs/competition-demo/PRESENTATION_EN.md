# CyberShield Ethiopia — Competition Presentation Notes (English)

**Platform:** CyberShield Ethiopia  
**Classification:** Official Presentation Notes (English)  
**Target Audience:** Competition Judges, University Faculty, Technical Evaluators  
**Estimated Spoken Reading Time:** 5–7 Minutes  

---

## 1. Project Introduction & Problem Context

CyberShield Ethiopia is a localized, privacy-first cybersecurity education and cognitive defense platform created specifically for the Ethiopian digital landscape.

Across Ethiopia, digital payment systems—such as Telebirr, CBE Birr, and mobile banking applications—have experienced explosive growth. While this expansion fosters financial inclusion, it has also exposed millions of citizens, students, and small enterprises to targeted digital fraud. Attackers frequently deploy deceptive SMS messages, fraudulent scholarship portals, fake customer support accounts on Telegram, and SIM swap schemes designed to steal OTP verification codes.

Most existing cybersecurity tools are ill-suited for the local context:
1. They require persistent high-speed internet connectivity.
2. They operate exclusively in English, excluding millions of native speakers.
3. They exfiltrate sensitive queries and credentials to foreign cloud services.

CyberShield Ethiopia bridges this gap by providing an **offline-first, trilingual, privacy-preserving** educational platform that equips citizens with practical defensive habits.

---

## 2. Core Project Objectives

1. **Practical Threat Literacy:** Teach citizens how to recognize, analyze, and neutralize localized scams before financial or identity harm occurs.
2. **Equitable Linguistic Access:** Deliver complete, native user experiences across English, Afaan Oromoo, and Amharic with zero missing keys and local typography.
3. **Absolute Data Privacy:** Guarantee that sensitive inputs—including passwords, payment card numbers, and incident descriptions—never leave the user's device.
4. **Resilient Self-Reliance:** Operate 100% offline using bundled local heuristics, offline knowledge bases, and genuine in-browser machine learning models.

---

## 3. Major Features & Implemented Architecture

CyberShield Ethiopia is architected around self-contained modular components:

- **Shared AI Assistant:** An offline-first conversational guide powered by an indexed knowledge base of 11 verified cybersecurity topics across EN, OM, and AM. Contextual entry points in every module provide tailored guidance and return navigation.
- **Module M1 (Link & Threat Checker):** Dual-layer analysis combining 10 URL structural rules and 10 SMS heuristic indicators with a trained offline lexical machine learning classifier.
- **Module M2 (Password Vault & Generator):** Client-side Shannon entropy evaluation ($H = -\sum p \log_2 p$), Ethiopian dictionary pattern warnings, and CSPRNG passphrase generation via `window.crypto.getRandomValues`.
- **Module M3 (Incident Report Assistant):** In-browser machine learning text classification that suggests appropriate threat categories, validates sensitive inputs (Luhn algorithm card scrubbing), provides verified emergency hotlines (933, 994, 951, 991), and exports client-side PDF dossiers.
- **Module M4 (Website Security Simulation):** Educational inspection of HTTP security headers (CSP, HSTS, Secure cookies) across sandboxed architectural fixtures (`DS-A`, `DS-B`, `DS-C`) without live outbound scanning.
- **M5 Cyber Academy & Cyber Hero Journey:** A gamified narrative campaign with interactive missions, practice pools, rank progression, and local storage persistence.

---

## 4. Privacy & Data Protection Invariants

CyberShield Ethiopia enforces strict, auditable privacy boundaries:
- **Zero Credential Exfiltration:** Passwords in M2 and typed queries in the Assistant are processed entirely in browser memory. Passwords are never sent across network sockets, stored in cookies, or written to server logs.
- **Client-Side Incident Triage:** M3 incident narratives remain in local browser storage; zero incident text is transmitted to central servers.
- **Fail-Closed External AI Gate:** Outbound connections to external LLM providers (e.g., Gemini or Groq) are disabled by default. If enabled, queries are strictly gated behind an explicit consent checkbox, and secrets/tokens are sanitized before dispatch.
- **32-Bit Hash Prefix CTI:** When optional Cyber Threat Intelligence lookups are enabled, queries transmit only 32-bit SHA-256 hash prefixes. Full URLs are never sent to external reputation APIs.

---

## 5. Evidence-Backed Machine Learning Contributions

The platform integrates three genuine, inspectable machine learning models backed by reproducible metrics:

1. **M1 URL Lexical Classifier (`ml_url_lexical_v1`):**
   - *Architecture:* 12-feature Softmax Classifier.
   - *Data:* 1,000 verified records from the CC BY 4.0 UCI PhiUSIIL Phishing URL Dataset (800 train, 200 held-out test).
   - *Results:* **92.50% test accuracy**, **0.9250 macro F1**, **0.2142 log loss** (+39.50% empirical predictive lift over the 53.00% majority test mode).
   - *Parity:* Verified $0.0$ maximum feature discrepancy between Python backend and JavaScript frontend runtimes.
2. **M3 Incident Text Classifier (`ml_m3_incident_v1`):**
   - *Architecture:* 18-feature Trilingual Softmax Classifier.
   - *Data:* Curated trilingual indicator corpus (120 records: 96 train, 24 held-out test).
   - *Results:* **95.83% test accuracy**, **0.9596 macro F1**, **0.2247 log loss**.
   - *Deployment:* Runs 100% in-browser client memory via `m3ModelWeights.js`.
3. **Cyber Hero Journey Recommender (`ml_softmax_v1`):**
   - *Architecture:* 8-feature Softmax Recommender trained on synthetic student telemetry.
   - *Pedagogical Guardrails:* Includes sparse-data fallback (attempts = 0), low-confidence fallback ($<0.55$), and transparent user toggle on the dashboard.
   - *State Isolation:* Verified that recommender evaluation never mutates total XP, badges, or completed missions.

---

## 6. Honest Technical Limitations & Disclosures

To maintain absolute academic integrity, the following operational limitations are openly disclosed:
1. **Curated & Synthetic Data Limitations:** M3 was evaluated on a curated 120-scenario proof-of-concept benchmark; performance on uncurated, noisy victim descriptions requires future field studies. The Journey recommender was trained on synthetic student data; real-student pedagogical lift has not yet been established.
2. **Lexical Scope in M1:** M1 inspects only structural URL strings. It does not fetch live HTML or execute JavaScript on destination servers.
3. **Automated Browser Automation Status:** The application was verified via 542 Vitest DOM/SSR component tests and manual user verification; automated headless browser automation remains blocked because no browser driver is installed on the host.
4. **Server-Side PostgreSQL State:** Port 5432 is not currently listening. The platform operates reliably in Guest Mode using browser `localStorage`. Multi-user server-side authentication and cloud sync remain inactive.
5. **Educational Scope:** CyberShield Ethiopia provides educational guidance and threat awareness. It does not guarantee absolute security or replace official law enforcement agencies.

---

## 7. Closing Statement

CyberShield Ethiopia demonstrates that modern cybersecurity education does not require invasive surveillance, high-speed cloud dependencies, or language barriers. By combining offline-first web technologies, client-side cryptography, and genuine localized machine learning, we deliver practical, accessible digital armor to Ethiopian citizens.

