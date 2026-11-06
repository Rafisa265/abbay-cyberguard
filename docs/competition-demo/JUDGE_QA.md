# CyberShield Ethiopia — Competition Judge Q&A Guide

**Project:** CyberShield Ethiopia  
**Repository:** `D:\CyberShield-Ethiopia`  
**Target Audience:** Competition Judges, Academic Evaluators, and Technical Assessors  
**Scope:** Verifiable Implementation Baseline (October 2026)

---

## Overview

This guide provides accurate, technically rigorous, and honest answers to 15 anticipated questions from competition judges and academic evaluators. Every answer reflects the actual codebase, model artifacts, test suites, and operational boundaries of CyberShield Ethiopia.

---

## 1. What problem does CyberShield Ethiopia solve?

**Problem Statement:**  
Ethiopia is undergoing rapid digital transformation with widespread adoption of mobile banking (Telebirr, CBE Birr), digital government services, and e-commerce. However, digital cybersecurity literacy remains critically low. Everyday citizens frequently fall victim to localized SMS phishing, fake call-center scams, credential theft, and social-media impersonation.

Existing cybersecurity education tools are overwhelmingly designed for Western audiences, published exclusively in English, dependent on high-speed internet connectivity, and focused on enterprise IT rather than grassroots citizen defense.

**The CyberShield Solution:**  
CyberShield Ethiopia bridges this gap by providing an **offline-first, privacy-preserving, trilingual cybersecurity learning and triage platform**. It equips users with practical skills (phishing URL analysis, password hygiene, incident triage, security quizzes, and safe website evaluation) tailored specifically to the Ethiopian digital landscape.

---

## 2. Who are its intended users?

1. **Everyday Citizens & Mobile Banking Users:** Individuals using Telebirr, CBE Birr, and digital banking who need immediate guidance to recognize scams and report fraud.
2. **University & High School Students:** Learners seeking interactive, gamified cybersecurity fundamentals (Cyber Hero Journey, Security Games, M1–M5 curriculum).
3. **Small Business Owners & Administrative Staff:** Non-technical operators who manage business social media, emails, and financial transactions without dedicated IT security staff.
4. **Community Educators:** Trainers delivering digital literacy workshops in regional centers with intermittent or zero internet connectivity.

---

## 3. What makes it useful for Ethiopian users?

- **Localized Scam Patterns:** Exercises, link simulations, and incident triage scenarios directly reflect prevalent local threats—such as CBE Birr account suspension scams, fake Ethio Telecom 5G lottery SMS, Telegram investment pyramids, and unauthorized SIM-swap alerts.
- **National Hotline Integration:** Module 3 (Incident Response) provides instant, one-tap connection details to verified Ethiopian authorities:
  - Ethio Telecom Customer Support: **994**
  - Commercial Bank of Ethiopia (CBE) Fraud Hotline: **951**
  - Information Network Security Administration (INSA / Ethio-CERT): **963**
  - Ethiopian Federal Police Cyber Crime Unit: **991**
- **Trilingual Parity:** Available in **English**, **Afaan Oromoo**, and **Amharic** (Ethiopic script), ensuring users learn in their primary language.
- **Low-Bandwidth & Offline Resilience:** Fully operable in low-connectivity areas or during network blackouts.

---

## 4. Why support three languages?

Ethiopia is a multilingual nation where millions of active mobile subscribers and banking customers are native speakers of Afaan Oromoo or Amharic and have limited English proficiency.

- **Equitable Protection:** High-risk scam victims are often vulnerable precisely because security warnings and educational materials are not accessible in their mother tongue.
- **100% Key Parity:** The application enforces complete translation parity across all three languages (`en.js`, `om.js`, `am.js` with 0 missing keys verified by automated CI unit tests).
- **Trilingual ML Incident Triage:** The Module 3 classification engine processes incident narratives in English, Afaan Oromoo, and Amharic using language-specific lexical feature vectors.

---

## 5. What works offline?

CyberShield Ethiopia is designed as an **offline-first single-page application (SPA)**:

| Feature / Module | Offline Availability | Mechanism |
| :--- | :---: | :--- |
| **M1: Phishing Link Inspector** | ✅ 100% Offline | Pure client-side JS implementation of the 12-feature lexical ML classifier (`mlUrlLexical.js`). |
| **M2: Password Strength & Entropy** | ✅ 100% Offline | In-browser NIST entropy math + zxcvbn evaluation. Zero server calls. |
| **M3: Incident Response & Triage** | ✅ 100% Offline | In-browser 18-feature trilingual ML classifier (`mlM3Incident.js`) + local PDF report generation. |
| **M4: Website Security Simulation** | ✅ 100% Offline | Educational static rule engine & simulated security header check. |
| **M5 & Learn Curriculum** | ✅ 100% Offline | All interactive modules, lesson content, and quizzes bundle with the frontend build. |
| **Cyber Hero Journey** | ✅ 100% Offline | Progress engine, badge awards, and client-side Softmax recommendation copilot. |
| **Security Games** | ✅ 100% Offline | Interactive interactive scam-detection games run purely in browser memory. |
| **AI Assistant** | ✅ Offline Fallback | Built-in deterministic FAQ knowledge base with contextual routing in all 3 languages. |
| **XP & Progress Tracking** | ✅ 100% Offline | Guest mode persists all scores, badges, and state in browser `localStorage`. |

*Note: Live backend synchronization and external online AI queries (e.g. Gemini API) require internet access and explicit user consent.*

---

## 6. How does M1 differ from a live threat-intelligence lookup?

| Attribute | M1 Lexical Classifier (`ml_url_lexical_v1`) | Live Threat-Intel Lookup (e.g. VirusTotal, Google Safe Browsing) |
| :--- | :--- | :--- |
| **Data Source** | Analyzes structural URL syntax (length, entropy, subdomains, token patterns, IP format). | Queries a centralized cloud database of reported malicious domains and hashes. |
| **Network Dependency** | **Zero.** Works 100% offline in browser memory. | Requires high-speed, active internet access for every single lookup. |
| **User Privacy** | **100% Private.** The URL is never transmitted over a network. | The queried URL is transmitted to third-party corporate servers. |
| **Zero-Day Detection** | Evaluates deceptive lexical patterns on new/unseen domains. | Cannot flag newly registered domains until human or automated reporting occurs. |
| **Limitation** | Cannot detect phishing hosted on legitimate, uncompromised high-reputation domains (e.g. Google Forms phishing). | Has access to real-time domain age, DNS history, and live page screenshots. |

**Summary:** M1 is a lightweight, privacy-preserving lexical defense layer designed for educational triage and offline utility, not a replacement for enterprise-scale threat-intelligence feeds.

---

## 7. How is password information protected?

- **Zero-Transmission Guarantee:** Passwords entered in Module 2 are evaluated entirely in browser memory.
- **No Network Requests:** Network monitoring confirms **0 outbound HTTP requests** during password input or evaluation.
- **No Storage Persistence:** Passwords are never written to `localStorage`, `sessionStorage`, indexedDB, or server logs.
- **Masking Controls:** Input masking (`type="password"`) is active by default with an optional reveal toggle.
- **Algorithmic Transparency:** Feedback is computed locally using character variety analysis, dictionary pattern recognition (zxcvbn), and Shannon entropy calculations.

---

## 8. Does M3 perform forensic investigations?

**No.** Module 3 is an **Incident Response and Emergency Triage Assistant**, not a digital forensics suite.

- **What it DOES:**
  - Classifies user incident narratives into defined categories (Phishing, Financial Fraud, Social Engineering, Malware, Extortion) using an 18-feature trilingual ML classifier.
  - Determines threat urgency (Critical, High, Medium, Low).
  - Delivers immediate step-by-step containment checklists (e.g., "Freeze CBE account", "Revoke Telegram active sessions", "Notify contacts").
  - Connects users directly to national response hotlines (INSA 963, CBE 951, Ethio Telecom 994).
  - Generates a local, printable PDF incident summary that victims can hand to police or bank investigators.
- **What it DOES NOT do:**
  - Does not extract hard drive images, memory dumps, or network packets.
  - Does not reverse-engineer malware binaries.
  - Does not conduct attribution or trace IP addresses of attackers.

---

## 9. Does M4 scan real public websites?

**No.** Module 4 is an **Educational Website Security Simulator**.

- It provides an interactive simulation designed to teach users how security headers (HTTPS, HSTS, CSP, X-Frame-Options) protect websites from attacks like clickjacking and cross-site scripting (XSS).
- It evaluates pre-configured mock domains and educational test cases safely.
- It does **not** conduct active port scanning, vulnerability exploitation, SQL injection testing, or unauthorized probing of external public websites. This design ensures safe, ethical, and legal use in academic environments.

---

## 10. What does ML contribute, and what evidence supports the claims?

Machine learning in CyberShield Ethiopia is applied strictly where it adds clear, measurable, and safe offline value:

| Model ID | Task | Model Architecture | Evaluated Metric | Benchmark / Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **`ml_url_lexical_v1`** (M1) | URL Phishing Classification | 12-feature Softmax Classifier | **92.50% Accuracy**<br>0.9250 Macro F1 | Held-out 200-sample test set from UCI PhiUSIIL (800 train / 200 test disjoint). Max JS/Python feature parity diff: `0.0`. |
| **`ml_m3_incident_v1`** (M3) | Incident Triage & Classification | 18-feature Trilingual Softmax | **95.83% Accuracy**<br>0.9596 Macro F1 | Held-out 24-sample test set from curated 120-scenario Ethiopian benchmark (96 train / 24 test disjoint). |
| **`ml_softmax_v1`** (Journey) | Next-Module Recommendation | 8-feature Softmax Recommender | Recommendation vector generation | Trained on 1,000 synthetic learner interaction vectors. Hard guardrails enforce zero attempts -> M1 and low confidence (<0.55) -> fallback. |

**Evidence Rigor:**
- Every model has verified training code, reproducible evaluation scripts, disjoint train/test splits, and dual-runtime parity checks (Python backend and JavaScript browser implementation).
- No speculative, unmeasured deep learning or "black box" claims are made.

---

## 11. How were training and evaluation data obtained?

1. **M1 Phishing URL Dataset:**
   - Source: The internationally recognized, peer-reviewed **UCI Machine Learning Repository: PhiUSIIL Phishing URL Dataset** (licensed under Creative Commons Attribution 4.0 International).
   - Extraction: 1,000 records (500 legitimate, 500 phishing) sampled deterministically, deduplicated, and split 80% (800) train and 20% (200) held-out test.
2. **M3 Incident Benchmark:**
   - Source: A curated benchmark of 120 structured cyber incident narratives representing realistic Ethiopian threats (bank fraud, SMS phishing, account hijacking, extortion) crafted across English, Afaan Oromoo, and Amharic.
   - Partition: Disjoint 80/20 train (96) and held-out test (24) split.
3. **Cyber Hero Journey Dataset:**
   - Source: 1,000 synthetic learner interaction records modeling student module completion rates, quiz scores, and retry patterns.
4. **Wangchuk Dataset Status:**
   - An access request draft was prepared during the engineering audit, but following ethical and fail-closed security protocols, it was **NOT sent** without explicit project authorization. The application relies strictly on the UCI PhiUSIIL benchmark.

---

## 12. What are the known limitations?

In the spirit of scientific and technical honesty, the project documents the following current limitations:

1. **Local Database & Cloud Sync:** The local PostgreSQL service is currently inactive on the test host. The application operates in Guest Mode using browser `localStorage`. User registration and cross-device cloud synchronization are disabled.
2. **Dataset Scale for M3:** While the M3 incident triage model achieves 95.83% accuracy on its 120-scenario benchmark, real-world deployment will require scaling the dataset to thousands of verified field incidents in partnership with local CERTs.
3. **M1 Threat Scope:** As a lexical model, M1 cannot detect phishing attacks hosted on unflagged, legitimate cloud domains (e.g. Google Forms or Canva phishing) without suspicious structural tokens.
4. **Browser Test Automation:** While all 253 backend unit/integration tests and 540 frontend unit tests run automated in CI, end-to-end browser workflows were validated via structured manual user verification because headless browser runtimes are not installed on the host.

---

## 13. What happens when PostgreSQL is unavailable?

- **Graceful Guest Mode Fallback:** The application detects the database state and seamlessly defaults to **Guest Mode**.
- **Full Offline Persistence:** All user achievements, experience points (XP), completed lessons, badges, and quiz results are stored locally in the browser's `localStorage`.
- **Zero Application Crashes:** All interactive modules (M1–M5, Journey, Games, Assistant) function normally without throwing unhandled exceptions or blocking user progression.
- **Explicit Status Indicators:** The UI informs the user that progress is saved locally on the device.

---

## 14. Is cross-device synchronization currently verified?

**No.** Cross-device synchronization is currently **unverified** because it requires:
1. A live, persistently reachable PostgreSQL database backend.
2. Server-side session authentication and profile sync endpoints.

Because the local development environment operates offline with PostgreSQL inactive, all demonstrated persistence is **local to the individual browser instance**. Multi-device sync is clearly designated as a roadmap milestone for future production hosting.

---

## 15. What would be developed next?

1. **Production Cloud Backend Deployment:** Activate a managed PostgreSQL database with secure JWT authentication and encrypted cross-device profile synchronization.
2. **Institutional Incident Reporting Bridge:** Collaborate with INSA and commercial banks to enable voluntary, privacy-anonymized incident forwarding from M3 directly to verified security operations centers.
3. **Expanded Regional Language Support:** Extend the localization engine and ML incident triage to Tigrinya, Somali, and Sidama.
4. **Automated E2E Testing Suite:** Integrate Playwright/Chromium CI test runners for automated cross-browser regression testing.
5. **Mobile Application Distribution:** Package the offline frontend as an Android PWA / APK via Capacitor or Tauri for widespread distribution across regional Ethiopian schools and community centers.

---

*Document prepared for CyberShield Ethiopia Competition Presentation.*  
*Cross-References:* [Demo Script](file:///D:/CyberShield-Ethiopia/docs/competition-demo/DEMO_SCRIPT.md) | [ML Evidence & Limitations](file:///D:/CyberShield-Ethiopia/docs/competition-demo/ML_EVIDENCE_AND_LIMITATIONS.md) | [PostgreSQL Audit](file:///D:/CyberShield-Ethiopia/docs/competition-demo/POSTGRESQL_READ_ONLY_AUDIT.md) | [Project Summary](file:///D:/CyberShield-Ethiopia/docs/competition-demo/PROJECT_SUMMARY.md)

