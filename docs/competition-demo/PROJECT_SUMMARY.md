# CyberShield Ethiopia — Competition Project Summary

**Project Title:** CyberShield Ethiopia  
**Repository:** `D:\CyberShield-Ethiopia`  
**License:** Educational & Open Source Architecture  
**Target Event:** Software Engineering & Innovation Competition  
**Evaluation Date:** October 2026

---

## Executive Summary

**CyberShield Ethiopia** is an offline-first, privacy-preserving cybersecurity education and incident triage platform built specifically for the Ethiopian digital ecosystem. It empowers citizens, students, and small business owners to defend against prevalent localized cyber threats—such as CBE Birr and Telebirr payment scams, SMS phishing, credential harvesting, and social media hijacking—through interactive simulations, verified national emergency guidance, and client-side machine learning, fully accessible in **English**, **Afaan Oromoo**, and **Amharic**.

---

## 1. Problem Statement

Ethiopia is experiencing an unprecedented surge in digital service adoption, including mobile money, digital banking, and e-government platforms. However, cybersecurity awareness remains critically low, leaving citizens exposed to aggressive social-engineering campaigns. Existing cybersecurity education tools suffer from four major barriers:
1. **Language Barrier:** Content is almost exclusively in English, excluding non-English speaking citizens.
2. **Context Gap:** Training materials focus on Western enterprise threats rather than Ethiopian-specific vectors (e.g. fake CBE Birr SMS alerts, Telegram investment schemes).
3. **Connectivity Dependency:** High-bandwidth, cloud-tethered platforms fail during regional network outages and in rural areas.
4. **Privacy Invasiveness:** Many verification tools transmit sensitive inputs (such as URLs and incident reports) to foreign cloud servers.

---

## 2. Target Users

- **Everyday Mobile Money Users:** Citizens using Telebirr, CBE Birr, and digital banking who need immediate validation of suspicious messages.
- **University & Secondary Students:** Learners developing foundational digital hygiene through gamified challenges and structured curricula.
- **Small Business Owners & Administrative Staff:** Non-technical operators who manage organizational social accounts and financial transactions.
- **Digital Literacy Educators:** Instructors delivering community cybersecurity workshops in low-connectivity environments.

---

## 3. Project Objectives

- **Democratize Cybersecurity Education:** Deliver accessible, interactive security fundamentals in three key Ethiopian languages with 100% key parity.
- **Enable Rapid Citizen Incident Triage:** Provide an offline-capable incident evaluation tool with actionable containment steps and verified national emergency hotlines.
- **Preserve User Privacy by Design:** Execute lexical URL checks, password entropy calculations, and triage classification entirely in local browser memory without transmitting private data over the network.
- **Ensure Offline Reliability:** Build a resilient single-page architecture that functions seamlessly during internet blackouts.

---

## 4. Implemented Architecture & Technologies

```
+-----------------------------------------------------------------------------------+
|                        CYBERSHIELD ETHIOPIA PLATFORM                              |
+-----------------------------------------------------------------------------------+
|  PRESENTATION LAYER (Frontend)                                                    |
|  - Framework: React 18 SPA bundled via Vite 8.3                                    |
|  - Languages: English (en), Afaan Oromoo (om), Amharic (am - Ethiopic Script)     |
|  - Testing: Vitest (540 unit/integration tests passing across 30 suites)          |
|  - Client ML Runtimes: Pure JavaScript Softmax classifiers & feature extractors   |
|  - Storage: Browser localStorage (Guest Mode progress, badges, XP)                |
+-----------------------------------------------------------------------------------+
                                    |
                                    v (Optional / Local API)
+-----------------------------------------------------------------------------------+
|  SERVICE LAYER (Backend)                                                          |
|  - Framework: FastAPI / Python 3.15 with Pydantic schemas                         |
|  - Testing: Pytest (253 tests passing across API, ML, and security suites)        |
|  - Security: Strict CORS, input sanitization, fail-closed offline AI boundaries   |
|  - ML Pipeline: Scikit-learn training & export pipeline for lightweight weights   |
|  - Database: SQLAlchemy ORM with SQLite fallback (PostgreSQL schema ready)        |
+-----------------------------------------------------------------------------------+
```

---

## 5. Main Functional Modules

- **M1 — Phishing Link Inspector:** Dual-engine lexical URL analyzer. Combines structural rule heuristics with a 12-feature machine-learning model (`ml_url_lexical_v1`) to evaluate suspicious domains without making external network queries.
- **M2 — Password Strength & Entropy Analyzer:** Client-side password evaluator utilizing NIST entropy mathematics and dictionary pattern matching (zxcvbn). Operates with zero network transmission, zero storage, and automatic masking.
- **M3 — Incident Response & Triage Assistant:** Incident categorization engine utilizing an 18-feature trilingual ML model (`ml_m3_incident_v1`). Delivers threat severity, immediate containment checklists, local printable PDF summaries, and direct hotline dials for INSA (963), CBE (951), Ethio Telecom (994), and Federal Police (991).
- **M4 — Website Security Simulator:** Educational interactive simulation demonstrating the defensive value of HTTPS, HSTS, CSP, and secure cookie headers against web-based attacks.
- **M5 & Learn Center:** Comprehensive cybersecurity curriculum covering mobile money security, 2FA, social engineering, and secure communications.
- **Cyber Hero Journey:** Gamified progression engine awarding experience points (XP) and badges, accompanied by a Softmax recommendation copilot (`ml_softmax_v1`).
- **Shared AI Assistant:** Contextual safety assistant featuring an offline deterministic rule/FAQ engine in 3 languages, with an opt-in external AI boundary requiring explicit user consent.

---

## 6. Evidence-Supported ML Contributions

| Model ID | Module | Purpose | Architecture | Evaluated Metric | Benchmark Dataset |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ml_url_lexical_v1` | M1 Link Inspector | URL Phishing Classification | 12-feature Softmax Classifier | **92.50% Test Accuracy**<br>0.9250 Macro F1 | 1,000 records from UCI PhiUSIIL (800 train / 200 held-out test). Zero JS/Python parity drift. |
| `ml_m3_incident_v1` | M3 Incident Triage | Incident Category & Severity | 18-feature Trilingual Softmax | **95.83% Test Accuracy**<br>0.9596 Macro F1 | 120-scenario Ethiopian incident benchmark (96 train / 24 held-out test). |
| `ml_softmax_v1` | Cyber Hero Journey | Adaptive Module Recommender | 8-feature Softmax Recommender | Recommender output | 1,000 synthetic learner vectors. Hard guardrails prevent badge/XP corruption. |

---

## 7. Offline-First & Privacy Design

- **Zero-Knowledge Password Verification:** Passwords never leave browser memory; network analysis confirms 0 HTTP packets transmitted during evaluation.
- **Local Machine Learning Execution:** All three ML models feature dual-runtime implementations capable of running 100% in client-side JavaScript.
- **Guest-Mode Resilience:** When backend databases are offline, the frontend defaults to Guest Mode, preserving learning history, XP, and badges locally via `localStorage`.
- **Consent-Gated Online AI:** External AI queries require explicit opt-in confirmation, with strict boundary warnings prohibiting transmission of credentials or private incident data.

---

## 8. Current System Limitations

1. **Inactive PostgreSQL on Local Test Host:** The host environment currently runs in Guest Mode; multi-device cloud synchronization and persistent server-side account registration are unverified and designated for future production hosting.
2. **Lexical Scope of URL Classifier:** M1 evaluates structural URL features; it cannot detect phishing attacks hosted on legitimate, uncompromised third-party platforms without lexical indicators.
3. **M3 Benchmark Scale:** The incident triage model was validated on a 120-scenario proof-of-concept dataset and requires expansion through institutional field telemetry.
4. **Browser Testing Methodology:** E2E user journeys were verified through rigorous manual user testing, as headless browser runtimes (Playwright/Chromium) are not installed on the development host.

---

## 9. Practical Social Benefit

- **Protects Financial Inclusion:** Helps vulnerable citizens safely navigate mobile financial services (Telebirr, CBE Birr) without falling prey to rampant SMS and social scams.
- **Removes Linguistic Exclusion:** Delivers parity in security education to Afaan Oromoo and Amharic speakers, who are often neglected by mainstream English-centric cybersecurity tools.
- **Reduces Load on Emergency Responders:** M3 empowers victims to immediately contain threats (e.g. freezing bank accounts) and provides structured reports, streamlining investigations for INSA and law enforcement.
- **Functions in Remote Communities:** Delivers critical cybersecurity literacy to schools and regional communities regardless of internet availability.

---

## 10. Realistic Next Steps

1. **Production Infrastructure:** Deploy managed cloud database infrastructure with secure JWT authentication for multi-device profile synchronization.
2. **Institutional Data Collaboration:** Partner with national institutions (INSA, commercial banks, Ethio-CERT) to train M3 on anonymized real-world incident telemetry.
3. **Regional Language Expansion:** Extend curriculum and ML triage to additional national languages (Tigrinya, Somali, Sidama).
4. **Automated CI/CD Browser Pipeline:** Integrate Playwright E2E automation into the project test suite.
5. **Mobile Distribution:** Package the application as an offline Android PWA / APK for deployment in community centers and secondary schools.

---

*CyberShield Ethiopia — Empowering Ethiopian Digital Citizens with Privacy-First Cybersecurity Defense.*  
*Documentation Suite:* [Demo Script](file:///D:/CyberShield-Ethiopia/docs/competition-demo/DEMO_SCRIPT.md) | [Judge Q&A](file:///D:/CyberShield-Ethiopia/docs/competition-demo/JUDGE_QA.md) | [ML Evidence](file:///D:/CyberShield-Ethiopia/docs/competition-demo/ML_EVIDENCE_AND_LIMITATIONS.md) | [PostgreSQL Audit](file:///D:/CyberShield-Ethiopia/docs/competition-demo/POSTGRESQL_READ_ONLY_AUDIT.md)

