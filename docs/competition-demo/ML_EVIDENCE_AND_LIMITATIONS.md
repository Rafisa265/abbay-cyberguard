# CyberShield Ethiopia — Machine Learning Evidence, Artifacts & Limitations

**Platform:** CyberShield Ethiopia  
**Document Purpose:** Academic & Technical Evidence Audit for Competition Judges  
**Evaluation Date:** October 2026  
**Auditor Classification:** Machine Learning Architecture & Reproducibility Verification  

---

## 1. Executive Summary & Verification Methodology

Historically, cybersecurity education software has frequently conflated static heuristics, hard-coded rules, third-party API lookups, and generative AI under broad, unverified marketing terminology.

This document establishes the **ground-truth technical reality** of the machine learning models implemented in **CyberShield Ethiopia**:
1. All three machine learning models—**M1 URL Lexical Classifier**, **M3 Incident Text Classifier**, and the **Cyber Hero Journey Recommender**—exist as inspectable mathematical artifacts with dual-runtime implementations in Python and JavaScript.
2. Every quantitative metric cited below has been **directly reproduced and verified** using local scripts and offline datasets in the project repository without external network connections.
3. Strict academic boundaries are maintained: curated proof-of-concept evaluations are explicitly distinguished from real-world victim testing, and synthetic student telemetry is disclosed without exaggerated efficacy claims.

---

## 2. Model 1: M1 Offline Lexical URL Classifier (`ml_url_lexical_v1`)

### A. Architectural Specification
- **Model Identifier:** `ml_url_lexical_v1`
- **Algorithm:** Softmax Binary Logistic Regression with $L_2$ regularization ($\lambda = 0.001$, learning rate $\alpha = 0.1$, batch size 32, 250 epochs).
- **Inference Locations:**
  - *Backend:* `backend/app/routes_m1.py` (`POST /api/v1/m1/ml-predict`) via `backend/app/data/ml_m1_url_classifier.json`.
  - *Frontend:* `frontend/src/lib/m1.js` (`predictUrlLexical`) via `frontend/src/lib/m1ModelWeights.js`.
- **Feature Vector Dimensions (12 Continuous/Binary Features):**
  1. `length_url`: Total character count of normalized URL string.
  2. `length_domain`: Character count of domain component.
  3. `length_path`: Character count of path component (normalized $0$ for root).
  4. `nb_subdomains`: Number of subdomain labels preceding the registered domain.
  5. `nb_dots`: Count of period (`.`) characters in the full URL.
  6. `nb_hyphens`: Count of hyphen (`-`) characters in the full URL.
  7. `ratio_digits_url`: Ratio of numeric digits ($0$–$9$) to total length.
  8. `has_ip_host`: Binary flag ($1$ if host is a raw IPv4/IPv6 address, $0$ otherwise).
  9. `has_at_symbol`: Binary flag ($1$ if URL contains `@` credential delimiter, $0$ otherwise).
  10. `is_https`: Binary flag ($1$ if scheme is HTTPS, $0$ otherwise).
  11. `has_suspicious_keyword`: Binary flag ($1$ if URL contains brand spoofing tokens like `telebirr`, `cbe`, `login`, `verify`, `bonus`).
  12. `domain_entropy`: Shannon entropy in bits per character of the registered domain string ($H = -\sum p_i \log_2 p_i$).

### B. Feature Extraction Parity Verification
- **Test File:** `frontend/src/lib/m1.test.js` & `backend/tests/test_m1_url_ml.py`.
- **Result:** Exact cross-runtime numerical equivalence. The maximum floating-point discrepancy between Python `extract_url_feature_vector()` and JavaScript `extractUrlFeatures()` across test fixtures is **$0.0$ max diff**.

### C. Dataset Provenance & Split Integrity
- **Dataset Source:** CC BY 4.0 UCI PhiUSIIL Phishing URL Dataset.
- **Citation:** Prasad, A. & Chandra, S. (2024). *PhiUSIIL Phishing URL (Website) [Dataset]*. UCI Machine Learning Repository. DOI: [10.1016/j.cose.2023.103545](https://doi.org/10.1016/j.cose.2023.103545).
- **Local Artifact Path:** `data/m1_url_pilot/splits/benchmark_phiusiil.jsonl`.
- **Total Audited Records:** 1,000 verified URL records.
- **Split Ratio:** 80% Train (800 records), 20% Held-Out Test (200 records). Seed: 42.
- **URL Disjointness:** **100% URL disjointness verified**. Exactly 0 duplicate URLs exist across the train and test splits.

### D. Reproducible Evaluation Metrics (Held-Out 200 Test Records)
Evaluated via `python backend/app/ml/train_m1_url_classifier.py`:

| Evaluation Metric | Measured Value | Baseline Comparison | Empirical Lift | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Accuracy** | **92.50%** | 47.00% (Training-set majority prior) | **+45.50%** | `AUTOMATED-VERIFIED` |
| **Macro F1 Score** | **0.9250** | 0.3197 (Baseline prior) | **+0.6053** | `AUTOMATED-VERIFIED` |
| **Mean Log Loss** | **0.2142** | 0.6917 (Prior loss) | **-0.4775** | `AUTOMATED-VERIFIED` |
| **Test Majority Accuracy** | 92.50% | 53.00% (In-sample test phishing mode) | **+39.50%** | `AUTOMATED-VERIFIED` |

- **Confusion Matrix Breakdown (200 Held-Out Records):**
  - Legitimate ground-truth (94 records): 92 True Negatives, 2 False Positives.
  - Phishing ground-truth (106 records): 93 True Positives, 13 False Negatives.
- **Per-Class Metrics:**
  - Legitimate Class: Precision = 0.8762, Recall = 0.9787, F1 = 0.9246 (Support = 94).
  - Phishing Class: Precision = 0.9789, Recall = 0.8774, F1 = 0.9254 (Support = 106).

### E. Known Limitations & Technical Scope
1. **Lexical Boundary:** The classifier operates exclusively on URL character distributions. It cannot inspect dynamic JavaScript forms, HTML payloads, or multi-hop cloaking redirects.
2. **Multi-Tenant Domain Overlap:** 13 multi-tenant hosting domains (e.g., `yolasite.com`, `repl.co`) exist in both splits, reflecting real-world cloud hosting ambiguity.
3. **Advisory Weighting:** In the M1 user interface, the ML verdict is presented in an advisory factor card alongside 10 heuristic rules and optional CTI. It does not unilaterally override explicit rule triggers.

---

## 3. Model 2: M3 In-Browser Incident Text Classifier (`ml_m3_incident_v1`)

### A. Architectural Specification
- **Model Identifier:** `ml_m3_incident_v1`
- **Algorithm:** 5-Class Softmax Logistic Regression with trilingual token feature weighting.
- **Inference Location:** **100% Client-Side In-Browser Memory** via `frontend/src/lib/m3.js` (`m3ModelWeights.js`) and dual Python artifact `backend/app/data/ml_m3_incident_classifier.json`.
- **Target Threat Categories (5 Classes):**
  1. `fraud`: Advance-fee lottery, fake job deposits, Telebirr transfer scams.
  2. `phishing`: Fake banking portals, deceptive login links, credential harvesters.
  3. `takeover`: Stolen Telegram sessions, password resets, account locking.
  4. `malware`: Malicious APK sideloading, accessibility service abuse, banking trojans.
  5. `sim_otp`: SIM swap impersonation, Ethio Telecom customer care OTP theft.
- **Feature Vector Dimensions (18 Trilingual Feature Groups):**
  - Includes localized indicator terms in English, Afaan Oromoo, and Amharic: `otp_secret`, `telecom_brand`, `sim_deactivation`, `bank_financial`, `telegram_messaging`, `apk_malware`, `deposit_fee`, `job_recruitment`, `lottery_prize`, etc.
  - Substring matching performs morphological stemming for Afaan Oromoo case suffixes (`-ii`, `-iin`) and Amharic prefixes (`የ-`, `ለ-`).

### B. Dataset Provenance & Split Integrity
- **Corpus Origin:** Project-curated trilingual benchmark of 120 authentic indicator scenarios across English, Afaan Oromoo, and Amharic.
- **Training Artifact:** `backend/app/ml/train_m3_incident_classifier.py`.
- **Split Ratio:** 80% Train (96 records), 20% Held-Out Test (24 records). Seed: 42.

### C. Reproducible Evaluation Metrics (Held-Out 24 Test Scenarios)
Evaluated via `python backend/app/ml/train_m3_incident_classifier.py`:

| Evaluation Metric | Measured Value | Baseline Comparison | Empirical Lift | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Accuracy** | **95.83%** | 12.50% (Uniform prior) | **+83.33%** | `AUTOMATED-VERIFIED` |
| **Macro F1 Score** | **0.9596** | 0.0444 (Uniform prior) | **+0.9152** | `AUTOMATED-VERIFIED` |
| **Mean Log Loss** | **0.2247** | 1.6094 (Random guess) | **-1.3847** | `AUTOMATED-VERIFIED` |
| **Test Majority Accuracy** | 95.83% | 25.00% (Phishing test mode) | **+70.83%** | `AUTOMATED-VERIFIED` |

- **Confusion Matrix Breakdown (24 Held-Out Records):**
  - `fraud` (3 support): 3 correct, 0 errors.
  - `phishing` (6 support): 6 correct, 0 errors.
  - `takeover` (5 support): 5 correct, 0 errors.
  - `malware` (5 support): 5 correct, 0 errors.
  - `sim_otp` (5 support): 4 correct, 1 predicted as `takeover`.
- **Per-Class Metrics:**
  - `fraud`: Precision = 1.0, Recall = 1.0, F1 = 1.0.
  - `phishing`: Precision = 1.0, Recall = 1.0, F1 = 1.0.
  - `takeover`: Precision = 0.8333, Recall = 1.0, F1 = 0.9091.
  - `malware`: Precision = 1.0, Recall = 1.0, F1 = 1.0.
  - `sim_otp`: Precision = 1.0, Recall = 0.80, F1 = 0.8889.

### D. Critical Academic Limitations & Disclosures
1. **Proof-of-Concept Evaluation Only:** This test rigorously validates that the trilingual keyword weighting and Softmax mathematics operate properly across English, Afaan Oromoo, and Amharic. **It does not establish operational performance on noisy, unstructured, real-world victim narratives.**
2. **Confidence Gating:** If typed narrative text produces an ambiguous probability distribution (confidence $< 0.50$), automated category suggestions are deliberately withheld to avoid misclassifying citizen reports.
3. **Zero Plaintext Exfiltration:** Text typed into M3 never leaves browser memory. The model evaluates the string locally, and PDF generation executes inside client DOM without API calls.

---

## 4. Model 3: Cyber Hero Journey Adaptive Recommender (`ml_softmax_v1`)

### A. Architectural Specification
- **Model Identifier:** `ml_softmax_v1`
- **Algorithm:** Multi-Class Softmax Classifier predicting optimal pedagogical difficulty (`beginner`, `intermediate`, `advanced`).
- **Inference Locations:**
  - *Backend:* `backend/app/ml/service.py` (`POST /api/v1/ml/recommend`).
  - *Frontend:* `frontend/src/lib/journeyModelWeights.js`.
- **Feature Vector Dimensions (8 Student Telemetry Features):**
  1. `recent_accuracy`: Rolling accuracy over last 10 attempts ($0.0$–$1.0$).
  2. `consecutive_errors`: Current unbroken failure streak ($0$–$5$).
  3. `failure_streak`: Longest recorded failure streak ($0$–$10$).
  4. `beginner_success_rate`: Accuracy on foundational missions ($0.0$–$1.0$).
  5. `intermediate_success_rate`: Accuracy on core missions ($0.0$–$1.0$).
  6. `advanced_success_rate`: Accuracy on tactical missions ($0.0$–$1.0$).
  7. `total_attempts_norm`: Normalized cumulative attempts count ($\min(N/50, 1.0)$).
  8. `current_difficulty_code`: Categorical encoding of active difficulty tier.

### B. Training Provenance Disclosure
- **Training Pipeline:** Synthetically generated student telemetry vectors (`backend/app/ml/train_recommender.py` via `generate_synthetic_pipeline_dataset`).
- **Training Rationale:** In an offline educational environment with zero user surveillance, collecting real student telemetry violates core privacy invariants. Synthetic telemetry profiles were modeled on pedagogical progression rules.
- **Efficacy Limitation:** **Synthetic telemetry does not prove real-world learning efficacy.** This model demonstrates functional personalization mechanics and architectural parity ($10^{-12}$ tolerance between Python and JS), but real-world educational lift remains an open empirical question.

### C. Pedagogical Guardrails & State Isolation
The ML recommender is never applied blindly:
1. **Guard 1 (Sparse Data Guard):** If student telemetry has 0 recorded attempts, the system automatically bypasses the ML model and returns `deterministic_fallback` (`reason: insufficient_data`), recommending foundational beginner missions.
2. **Guard 2 (Low Confidence Guard):** If the Softmax prediction confidence drops below $0.55$, the system safely falls back to deterministic curriculum rules.
3. **Guard 3 (Remediation Guard):** If a student records 2 or more consecutive errors in any category, foundational remediation is enforced regardless of model output.
4. **State Isolation Invariant:** Recommendation evaluation is strictly read-only. Calling the recommender **never mutates total XP, completed missions, or earned badges**, preventing duplicate-reward vulnerabilities.
5. **Dashboard Toggle:** An accessible switch on the Agent Dashboard allows educators and students to disable ML recommendations and revert to pure pedagogical rules.

---

## 5. Non-ML Module Justification (M2 & M4)

To prevent the common mistake of forcing machine learning where it adds risk without benefit, Modules M2 and M4 deliberately avoid ML:

1. **Module M2 (Password Safety):**
   - *Technical Reality:* Pure local mathematical Shannon entropy ($H = -\sum p_i \log_2 p_i$) and WebCrypto PBKDF2 with SHA-256.
   - *Justification:* Passwords require mathematically provable entropy thresholds and known dictionary checks, not statistical approximations. Passing passwords into ML models risks data exposure, training leakage, and side-channel vulnerabilities.
2. **Module M4 (Website Security Simulation):**
   - *Technical Reality:* Educational simulation operating on static fixtures (`DS-A`, `DS-B`, `DS-C`).
   - *Justification:* Simulating security headers without live network probing prevents SSRF attacks, denial-of-service risks, and legal liability. Machine learning provides no pedagogical advantage for static header demonstrations.

---

## 6. Dataset Governance & Wangchuk Permission Gate

- **Target Dataset:** Wangchuk Phishing URL Dataset (Mendeley Data, DOI: [10.17632/3jddhy2f6s.1](https://doi.org/10.17632/3jddhy2f6s.1)).
- **Authority Tracking File:** `data/m1_url_pilot/WANGCHUK_AUTHOR_INQUIRY_DRAFT.md`.
- **Current Legal Status:** `DRAFT — NOT SENT; PERMISSIONS UNRESOLVED; NO DATASET ACQUIRED`.
- **Governance Boundary:**
  - Zero bytes of the restricted Wangchuk dataset were downloaded, sampled, or ingested.
  - The repository's raw pilot directory contains exclusively CC BY 4.0 UCI PhiUSIIL (`phiusiil_sample.csv`) and Tranco research domains (`tranco_W3ZV9_top1000.csv`).
  - The offline ingestion adapter (`ingest_wangchuk.py`) is verified using synthetic unit fixtures with socket network connections mocked to fail closed.

---
*End of Machine Learning Evidence & Limitations Document.*  
*Cross-References:* [Demo Script](file:///D:/CyberShield-Ethiopia/docs/competition-demo/DEMO_SCRIPT.md) | [Judge Q&A](file:///D:/CyberShield-Ethiopia/docs/competition-demo/JUDGE_QA.md) | [PostgreSQL Audit](file:///D:/CyberShield-Ethiopia/docs/competition-demo/POSTGRESQL_READ_ONLY_AUDIT.md) | [Project Summary](file:///D:/CyberShield-Ethiopia/docs/competition-demo/PROJECT_SUMMARY.md)


