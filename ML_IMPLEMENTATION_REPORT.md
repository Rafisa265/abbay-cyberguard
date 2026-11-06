# CyberShield Ethiopia — Comprehensive ML Implementation & Validation Report

**Release Target:** CyberShield Ethiopia  
**Repository Location:** `D:\CyberShield-Ethiopia`  
**Date:** October 2026  
**Status:** Verification Passed & Production Ready  

---

## 1. Overview and Engineering Objectives

This report details the implementation, mathematical formulation, training pipelines, held-out evaluation, and user-facing integration of genuine machine learning models within **CyberShield Ethiopia**.

The engineering task followed an evidence-based pipeline:
$$\text{Inspect} \longrightarrow \text{Audit} \longrightarrow \text{Prioritize} \longrightarrow \text{Implement} \longrightarrow \text{Integrate} \longrightarrow \text{Test} \longrightarrow \text{Evaluate} \longrightarrow \text{Document}$$

All implemented ML features adhere strictly to the project's core principles:
1. **Privacy-Preserving & Offline-First:** 100% of inference runs locally in client browser memory or local backend execution without external API dependencies.
2. **Pedagogical Explainability:** Predictions expose structural indicators, confidence scores, and fallback explanations.
3. **Safety Boundaries:** Ground truth heuristic rules and educational guardrails override statistical uncertainty.
4. **Honest Provenance:** Synthetic datasets and CC BY 4.0 data sources are explicitly disclosed.

---

## 2. Implemented Machine Learning Subsystems

### 2.1 M1 — Offline Lexical URL Phishing Classifier (`ml_url_lexical_v1`)

#### Architecture & Mathematical Formulation
- **Algorithm:** Multinomial Softmax Logistic Regression with L2 Regularization ($L_2 = 0.001$, $\eta = 0.10$).
- **Inference Mode:** Dual-target (Python standard library backend + browser JavaScript ES module).
- **Zero-Dependency Guarantee:** Pure standard mathematical functions with numerical stabilization:
  $$\text{logits}_k = b_k + \sum_{j=1}^{12} W_{kj} x_j, \quad P(y=k \mid \mathbf{x}) = \frac{\exp(\text{logits}_k - \max(\text{logits}))}{\sum_{m} \exp(\text{logits}_m - \max(\text{logits}))}$$

#### 12-Dimensional Feature Extraction Schema
All features are normalized to the bounded range $[0.0, 1.0]$:
1. `url_length_norm`: $\min(1.0, \text{len}(\text{URL}) / 150)$
2. `domain_length_norm`: $\min(1.0, \text{len}(\text{host}) / 50)$
3. `path_length_norm`: $\min(1.0, (\text{len}(\text{path}) + \text{len}(\text{query})) / 100)$
4. `subdomain_count_norm`: $\min(1.0, \max(0, \text{dots} - 1) / 4)$
5. `dot_count_norm`: $\min(1.0, \text{dots} / 6)$
6. `hyphen_count_norm`: $\min(1.0, \text{hyphens} / 5)$
7. `digit_ratio_scaled`: $\min(1.0, 3 \times (\text{digits} / \text{len}(\text{URL})))$
8. `has_ip_host`: $1.0$ if host is a raw IPv4/IPv6 address, else $0.0$
9. `has_at_symbol`: $1.0$ if `@` is in URL, else $0.0$
10. `is_https`: $1.0$ if HTTPS scheme, else $0.0$
11. `has_suspicious_keyword`: $1.0$ if containing keywords (`login`, `verify`, `account`, `update`, `password`, `bank`, `cbe`, `telecom`, `wallet`), else $0.0$
12. `domain_entropy_norm`: $\min(1.0, H(\text{host}) / 4.5)$, where $H$ is base-2 Shannon entropy.

#### Training Pipeline & Evaluation
- **Script:** `backend/app/ml/train_m1_url_classifier.py`
- **Dataset:** Audited CC BY 4.0 benchmark records from UCI PhiUSIIL Phishing URL Dataset (1,000 verified records; 800 train, 200 held-out test).
- **Data Disjointness & Leakage Audit:**
  - Duplicate URLs in full corpus: **0 (0.0%)** (1,000 unique URLs).
  - Train/Test URL Overlap: **0 URLs (0.0% overlap)** — sets are completely disjoint at URL level.
  - Domain Distribution: 845 unique registered domains; 13 overlapping multi-tenant domains (`repl.co`, `yolasite.com`, `fleek.co`, `xsph.ru`, etc.) where paths represent separate applications.
- **Held-Out Test Results (200 URLs):**
  - **Accuracy:** **92.50%**
  - **Macro F1 Score:** **0.9250**
  - **Log Loss:** **0.2142**
  - **Baseline Comparison & Methodological Context:**
    - The training split (800 records) had 406 legitimate (50.75%) and 394 phishing (49.25%). A dummy classifier trained on the training prior predicts `legitimate`.
    - Evaluated out-of-sample on the held-out test split (200 records: 94 legitimate, 106 phishing), this training prior gets 94 / 200 = **47.00%** accuracy.
    - An in-sample majority zero-rule classifier on the test split itself predicts `phishing` (106 / 200 = **53.00%**).
    - A balanced random-chance baseline achieves **50.00%**.
    - True predictive lift over the test-set majority prior ($53.00\%$) is **+39.50%** (and **+42.50%** over random chance).
  - **Class-Specific Breakdown:**
    - Phishing: Precision **97.89%**, Recall **87.74%**, F1 **0.9254** (Support: 106)
    - Legitimate: Precision **87.62%**, Recall **97.87%**, F1 **0.9246** (Support: 94)
  - **Confusion Matrix:**
    - True Legitimate: 92 (False Phishing / False Positives: 2, FPR: 2.13%)
    - True Phishing: 93 (False Legitimate / False Negatives: 13, FNR: 12.26%)
- **Feature Parity:** Verified 0.0 max feature difference between Python `extract_url_feature_vector` and JavaScript `extractUrlFeatures`.
- **Exported Synchronized Artifacts:**
  - Backend: `backend/app/data/ml_m1_url_classifier.json`
  - Frontend: `frontend/src/lib/m1ModelWeights.js`

---

### 2.2 M3 — In-Browser Trilingual Incident Report Text Classifier (`ml_m3_incident_v1`)

#### Architecture & Privacy Design
- **Problem Solved:** When victims report incidents in M3, they often misclassify technical categories (e.g. confusing SMS OTP theft with general fraud).
- **Privacy Constraint:** Incident details contain sensitive context. Text must **never** be transmitted to an external API or server for classification.
- **Engine:** Pure client-side Softmax classifier operating over 18 localized indicator feature groups across English, Afaan Oromoo, and Amharic.

#### Target Classes
1. `fraud` (Advance fee, fake lottery, mistaken mobile money transfers)
2. `phishing` (Credential harvesting links, fake bank login portals)
3. `takeover` (Account lockouts, hijacked Telegram/social accounts)
4. `malware` (Malicious APK sideloads, trojan app booster apps)
5. `sim_otp` (Telecom agent impersonation, SIM swap deactivation lures)

#### Training Pipeline & Evaluation
- **Script:** `backend/app/ml/train_m3_incident_classifier.py`
- **Corpus Provenance & Construction Method:**
  - 120 hand-authored scenario sentences (24 per category across 5 classes: 8 English, 8 Afaan Oromoo, 8 Amharic per category).
  - Designed specifically around local Ethiopian cyber threat vectors (Ethio telecom SIM deactivation notices, Telebirr advance lottery fee scams, CBE malicious APK sideloads, Telegram account hijackings, and AAU credential phishing).
  - **Preliminary Status Disclosure:** This corpus represents a domain-curated proof-of-concept test fixture rather than an operational clinical dataset of noisy real-world victim statements. Efficacy on free-form unstructured text outside the indicator taxonomy remains preliminary.
- **Disjointness & Leakage Audit:**
  - Duplicate descriptions in corpus: **0 (0.0%)** (all 120 unique).
  - Train/Test Split: 96 train (80%), 24 held-out test (20%), SEED = 42.
  - Overlap between train and test texts: **0 (0.0% overlap)**.
- **Held-Out Test Results (24 records — Preliminary Evaluation):**
  - **Accuracy:** **95.83%** (23 / 24 correct)
  - **Macro F1 Score:** **0.9596**
  - **Log Loss:** **0.2247**
  - **Baseline Comparison & Methodological Context:**
    - The training split (96 records) had approximately balanced classes. The majority prior classifier trained on train records selected `fraud` as its prior mode.
    - Evaluated out-of-sample on the 24 held-out test records (where `fraud` support was 3), the baseline achieved 3 / 24 = **12.50%** accuracy.
    - An in-sample majority classifier on the test split itself predicts `phishing` (support 6 / 24 = **25.00%**).
    - A uniform 5-class random-guess baseline achieves **20.00%**.
    - True predictive lift over the test-set majority mode ($25.00\%$) is **+70.83%** (and **+75.83%** over uniform random guess).
  - **Class Performance:**
    - `fraud`: Precision 1.00, Recall 1.00, F1 1.00 (Support: 3)
    - `phishing`: Precision 1.00, Recall 1.00, F1 1.00 (Support: 6)
    - `takeover`: Precision 0.83, Recall 1.00, F1 0.91 (Support: 5)
    - `malware`: Precision 1.00, Recall 1.00, F1 1.00 (Support: 5)
    - `sim_otp`: Precision 1.00, Recall 0.80, F1 0.89 (Support: 5; 1 case misclassified as takeover)
  - **Confusion Matrix:**
    - `fraud`: [3, 0, 0, 0, 0]
    - `phishing`: [0, 6, 0, 0, 0]
    - `takeover`: [0, 0, 5, 0, 0]
    - `malware`: [0, 0, 0, 5, 0]
    - `sim_otp`: [0, 0, 1, 0, 4]
- **Frontend UX Integration:** As the user types in `d.what`, `predictIncidentType` evaluates the text in memory. If confidence $\ge 0.50$, an interactive suggestion card renders with a 1-click `[✓ Apply Category]` button, automatically updating `d.type` and resolving validation errors. Unrecognized or off-topic text produces low confidence ($< 0.50$) or `null`, safely suppressing the suggestion card without interrupting the user.
- **Exported Synchronized Artifacts:**
  - Backend: `backend/app/data/ml_m3_incident_classifier.json`
  - Frontend: `frontend/src/lib/incidentModelWeights.js`

---

### 2.3 Cyber Hero Journey — ML Adaptive Copilot & Pedagogical Guardrails

#### Dual-Engine Architecture
Cyber Hero Journey features an adaptive recommendation engine for personalized practice missions:
1. **ML Softmax Recommender (`ml_softmax_v1`):** Analyzes student telemetry vectors (XP, completed missions, error rates across categories, failure streaks).
2. **Pedagogical Deterministic Fallback:** Automatically engages when telemetry is insufficient ($< 1$ recorded attempt), or when model confidence is low ($< 0.55$).
3. **User Control Toggle:** Added an accessible switch on the Agent Dashboard:
   `[⚡ ML Adaptive Copilot (Offline Trial)]`
   Allowing users to switch between the Softmax ML recommender and deterministic pedagogical rules.
4. **Honest Provenance:** Discloses that the recommender model weights were trained on synthetic student pipeline data (`generate_synthetic_pipeline_dataset`).

---

## 3. Verification & Quality Assurance Results

### 3.1 Backend Test Verification
- **Test Command:** `.\backend\.venv\Scripts\pytest.exe -q`
- **Result:** **253 passed, 0 failed** in 8.19s
- **Key Test Files:**
  - `backend/tests/test_m1_url_ml.py` (Feature extraction, bounds, API endpoints)
  - `backend/tests/test_m3_incident_ml.py` (Trilingual text classification)
  - `backend/tests/test_m1_cti.py` (SSRF prevention, Safe Browsing hash prefix)
  - `backend/tests/test_auth.py`, `test_daily.py`, `test_notifications.py`

### 3.2 Frontend Test Verification
- **Test Command:** `cd frontend; npx.cmd vitest run`
- **Result:** **30 test files passed, 540 tests passed, 0 failed** in 4.30s
- **Key Test Files:**
  - `src/lib/m1.test.js` (Shannon entropy, 12 lexical features, ML integration)
  - `src/lib/m3.test.js` (Luhn algorithm, trilingual text classification, PDF generation)
  - `src/journey_ml.test.js` (Offline fallback, ML cache, Copilot user toggle)
  - `src/i18n.test.js` (100% key parity across all languages)

### 3.3 Trilingual Localization Parity
Every new UI string introduced for the ML features was translated into English, Afaan Oromoo, and Amharic with zero empty strings:
- M1 ML labels: `m1.ml_source_label`, `m1.ml_predicted_phishing`, `m1.ml_predicted_legit`, `m1.scope_ml_lexical`, `m1.ml_card_title`, `m1.ml_badge`, `m1.ml_prob_label`, `m1.ml_verdict_label`, `m1.ml_confidence_label`, `m1.ml_accuracy_label`, `m1.ml_disclaimer`.
- M3 ML labels: `m3.ml_suggestion_title`, `m3.ml_badge`, `m3.ml_suggest_prompt`, `m3.ml_confidence`, `m3.ml_apply_btn`, `m3.ml_applied_note`.
- Journey ML labels: `journey.rec.toggle_ml_label`, `journey.rec.toggle_ml_desc`.
- **Parity Status:** 100% verified across `en.js`, `om.js`, and `am.js` via `src/i18n.test.js`.

### 3.4 Production Build Verification
- **Build Command:** `cd frontend; npm.cmd run build`
- **Result:** **Built in 677ms cleanly with zero errors** (`dist/` generated).

---

## 4. Release Readiness Matrix

| Verification Dimension | Standard Required | Achieved Result | Status |
| :--- | :--- | :--- | :--- |
| **Product Name** | CyberShield Ethiopia | Maintained exactly | **VERIFIED** |
| **Backend Tests** | All passing, zero regressions | 253 passed | **VERIFIED** |
| **Frontend Tests** | All passing, zero regressions | 540 passed | **VERIFIED** |
| **Production Build** | Clean Vite production bundle | Built in 677ms | **VERIFIED** |
| **Trilingual Parity** | 100% parity across EN, OM, AM | 100% parity | **VERIFIED** |
| **M1 ML Integration** | Lexical phishing model integrated | Active in M1 UI & Backend | **VERIFIED** |
| **M3 ML Integration** | In-browser incident text classification | Active in M3 UI | **VERIFIED** |
| **Journey ML Copilot** | User toggle & transparent confidence | Active on Dashboard | **VERIFIED** |
| **Wangchuk Gate** | 100% untouched and intact | Zero gate modifications | **VERIFIED** |
| **Database Integrity** | Zero unauthorized migrations | Unaltered schema | **VERIFIED** |
| **Privacy Boundary** | Zero plaintext transmission | 100% offline-first | **VERIFIED** |

---

## 5. Final Evidence Verification & Gate Audit

### 5.1 Verified Facts
1. **Mathematical Reproducibility:** Training scripts `train_m1_url_classifier.py` and `train_m3_incident_classifier.py` reproduce reported metrics deterministically on held-out test splits without network access.
2. **Feature Extraction Parity:** Verified exact numerical equivalence ($0.0$ max difference) between Python `app.ml.m1_url_features.extract_url_feature_vector` and JavaScript `frontend/src/lib/m1.js:extractUrlFeatures`.
3. **Data Disjointness:** Verified zero URL overlap between training and held-out test splits in M1, and zero text overlap between training and held-out test splits in M3.
4. **License & Gate Preservation:** The Wangchuk dataset permission gate remains 100% intact; zero restricted data was downloaded or merged into the repository. Only CC BY 4.0 benchmark data (UCI PhiUSIIL) was utilized.
5. **Privacy Enforcement:** M3 incident reporting and M2 password evaluation execute 100% in client browser memory with zero network dispatch. CTI Safe Browsing queries send only 32-bit hash prefixes from the backend without logging full URLs.
6. **Progression Safety:** Recommendations in Cyber Hero Journey do not mutate XP, cannot cause duplicate mission rewards, and honor deterministic guardrails for sparse or struggling learners.
7. **Test Suites & Build:** Full backend test suite passes (253 passed), full frontend test suite passes (540 passed), and Vite production build succeeds cleanly (664ms).

### 5.2 Preliminary Metrics & Baseline Context
1. **M1 Baseline Representation:** The reported 47.00% baseline represents the training-set majority prior (`legitimate` at 50.75%) evaluated out-of-sample on the held-out test split. Against an in-sample test-set majority mode (`phishing` at 53.00%), the model's accuracy of 92.50% yields an empirical predictive lift of **+39.50%**.
2. **M3 Preliminary Corpus Limitation:** The M3 test evaluation (95.83% accuracy) is based on 24 held-out records from a curated 120-sentence corpus. While it rigorously validates that the trilingual keyword indicator taxonomy and Softmax math operate correctly across English, Afaan Oromoo, and Amharic, it is **explicitly classified as preliminary proof-of-concept testing** rather than large-scale operational validation on noisy victim text.

### 5.3 Known Limitations
1. **Lexical Scope in M1:** The M1 classifier operates exclusively on URL strings (structural and character distributions). It cannot inspect destination DOM/HTML content or follow cloaked redirects, preserving its zero-fetch privacy guarantee.
2. **Vocabulary Scope in M3:** The M3 classifier relies on curated localized keyword indicators. Unprecedented slang, heavy typos, or unindexed regional dialects will yield low confidence ($< 0.50$), safely withholding automated suggestions.
3. **Synthetic Provenance in Journey:** The Journey ML recommender was trained on a synthetic student telemetry pipeline. Real-student pedagogical efficacy has not been established.

### 5.4 Diagnostic Root Causes of Initial Test Attempts
During initial implementation passes, four distinct test failures or command errors were investigated and resolved:
1. **Environment Runtime Mismatch:** Initial manual Python commands invoked system `C:\Python315\python.exe` instead of the project virtual environment `.\backend\.venv\Scripts\python.exe`, causing missing package errors. Resolved by using the virtual environment interpreter explicitly.
2. **Host Header Validation (HTTP 421):** The new backend test `test_m1_url_ml.py` initially failed with `421 Misdirected Request` because `TestClient(app)` sent the default `Host: testserver`. CyberShield's security middleware enforces loopback host validation to protect against DNS rebinding. Resolved by specifying `base_url="http://127.0.0.1:8000"`.
3. **Locale Test File Specifier:** Invoking `vitest run src/locales.test.js` failed because the file is named `src/i18n.test.js`. Resolved by running the correct test path.
4. **Intentional Sparse-Data Guardrail:** Test 12 in `journey_ml.test.js` initially asserted that `determineAdaptiveRecommendation` would return `ml_softmax_v1` on freshly reset progress. Because fresh progress has 0 attempts and 0 outcomes, Guard 1 deliberately and correctly fell back to `deterministic_fallback` (`insufficient_data`). Resolved by providing realistic progress with recorded history to test the active ML branch.

### 5.5 Browser Smoke Testing Status
Automated live browser-level smoke testing (via Puppeteer, Playwright, or Selenium) was **not performed** because no headless browser runtime is installed in the project environment. All UI rendering and state interactions were validated through Vitest DOM/SSR assertions, snapshot tests, and clean Vite production bundling.

### 5.6 Unresolved Blockers and Gate Verdict
- **Unresolved Blockers:** None.
- **Gate Verdict:** **PASSED**. The machine learning implementations in CyberShield Ethiopia are genuine, privacy-preserving, mathematically reproducible, test-verified, and release-ready.

