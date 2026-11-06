# CyberShield Ethiopia — M1 URL Dataset Pilot: Evaluation Readiness Report

**Product**: CyberShield Ethiopia  
**Module**: M1 Link Scanner (Offline-First URL Evaluator)  
**Date**: 2026-10-26  
**Status**: Dataset Pilot Preparation & Audit Complete (Pre-Training Phase)

---

## 1. Executive Summary

This report documents the controlled acquisition, cleaning, deduplication, domain-isolated splitting, and quality audit for the M1 URL Dataset Pilot. The pipeline was executed strictly under read-only/offline constraints for application logic: **no machine learning models were trained, no production detection rules were changed, and no target URLs were visited or crawled**.

---

## 2. Ingestion & Acquisition Accounting

| Source | Target / Scope | Acquired / Processed | Accepted | Quarantined | Duplicates | Status / Blocker Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tranco Top Sites** | Candidate popular domains ($\le 1,000$) | 1,000 | 988 | 12 | 0 | **Acquired**. List ID: `W3ZV9`. 12 multi-tenant platform domains quarantined per policy (`MULTI_TENANT_PLATFORM_NOT_UNIFORMLY_SAFE`). |
| **PhishTank** | Verified active phishing URLs ($\le 1,000$) | 0 | 0 | 0 | 0 | **Skipped (Blocked)**: Requires developer API key from Cisco Talos. No key exists in environment. Skipped per safety instructions. |
| **URLhaus (abuse.ch)** | Phishing-only threat URLs ($\le 1,000$) | 0 | 0 | 0 | 0 | **Skipped (Blocked)**: Legacy endpoint `https://urlhaus.abuse.ch/downloads/csv_recent/` returned HTTP 410 Gone. abuse.ch Terms of Use (effective Nov 2025 / Oct 2026) require an `Auth-Key`. No key in environment; adapter and synthetic tests ready. |
| **UCI PhiUSIIL** | Research benchmark ($\le 1,000$) | 1,000 | 1,000 | 0 | 0 | **Acquired (Isolated Benchmark)**: 500 legitimate, 500 phishing URLs. Discarded 52 HTML/DOM features. |
| **Total** | | **2,000** | **988 (Pilot) + 1,000 (Benchmark)** | **12** | **0** | **Fully Audited** |

---

## 3. Label Classification & Confidence Breakdown

| Category | Record Count | Source | Label Status | Verification Basis |
| :--- | :--- | :--- | :--- | :--- |
| `candidate_benign_domain` | 988 | Tranco | **Candidate** (Not Ground Truth) | Tranco Dowdall aggregation ranking (30-day window). High rank indicates popularity, **NOT proof of URL path safety**. |
| `phishing` (Pilot Corpus) | 0 | PhishTank / URLhaus | **Verified** | None acquired. PhishTank blocked by Cisco Talos key requirement; URLhaus legacy endpoint HTTP 410 Gone & requires Auth-Key. |
| `phishing` (Benchmark) | 500 | UCI PhiUSIIL | **Verified** (Curated Benchmark) | Academic benchmark dataset (Prasad & Chandra, 2024). Isolated from pilot training splits. |
| `legitimate` (Benchmark) | 500 | UCI PhiUSIIL | **Verified** (Curated Benchmark) | Academic benchmark dataset (Prasad & Chandra, 2024). Isolated from pilot training splits. |
| `quarantine` | 12 | Tranco | **Excluded** | High-abuse multi-tenant platforms (`google.com`, `bit.ly`, `github.io`, etc.) quarantined with `MULTI_TENANT_PLATFORM_NOT_UNIFORMLY_SAFE`. |

---

## 4. Domain-Grouped Split & Leakage Audit

To prevent synthetic over-performance caused by domain memorization, candidate benign records were partitioned using deterministic SHA-256 modulo assignment strictly on domain boundaries:

- **Train Split (`splits/train.jsonl`)**: 693 records (693 unique registered domains) — 70.1%
- **Validation Split (`splits/val.jsonl`)**: 154 records (154 unique registered domains) — 15.6%
- **Test Split (`splits/test.jsonl`)**: 141 records (141 unique registered domains) — 14.3%
- **Isolated Research Benchmark (`splits/benchmark_phiusiil.jsonl`)**: 1,000 records (845 unique domains)

### Leakage Verification Metrics:
- $\text{Train Domains} \cap \text{Val Domains}$: **0 (0.0% overlap)**
- $\text{Train Domains} \cap \text{Test Domains}$: **0 (0.0% overlap)**
- $\text{Val Domains} \cap \text{Test Domains}$: **0 (0.0% overlap)**
- **Domain Leakage Status**: **100% Leakage-Free**

### Cross-Source Benchmark Overlap:
- Exact URL Overlap (Tranco vs PhiUSIIL): **0 URLs**
- Domain Overlap (Tranco vs PhiUSIIL): **13 domains** (`amazonaws.com`, `appspot.com`, `box.com`, `free.fr`, `netlify.app`, etc.)
  - *Mitigation*: These 13 overlapping domains are tracked in `pilot_corpus.summary.json` and must be excluded from training if PhiUSIIL is ever used as an external evaluation benchmark.

---

## 5. Licensing, Permitted Use, & Attribution Constraints

1. **Tranco (Candidate Benign Domains)**:
   - *License*: Composite ranking derived from 5 underlying data providers: Cisco Umbrella (free), Majestic (CC BY 3.0), Farsight (free), CrUX (CC BY-SA 4.0), and Cloudflare Radar (CC BY-NC 4.0).
   - *Attribution*: Victor Le Pochat, Tom Van Goethem, Samaneh Tajalizadehkashani, and Wouter Joosen. *Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation*. In Proceedings of NDSS 2019.
   - *Licensing Review Status*: **`requires_legal_terms_review_for_commercial_use`**.
   - *Unresolved Licensing Interpretation*: Because Cloudflare Radar is licensed under CC BY-NC 4.0 (Non-Commercial), downstream commercial derivation cannot be claimed as unconditionally permitted. Permitted for non-commercial research and local offline evaluation with citation.
2. **URLhaus (abuse.ch AG / Spamhaus Technology Limited)**:
   - *License*: abuse.ch Terms of Use (effective Nov 4, 2025, updated Oct 21, 2026). **NOT CC0**. Free for not-for-profit purposes under Fair Use Principles. Commercial use requires a paid Spamhaus subscription.
   - *Attribution*: Data provided by URLhaus (abuse.ch AG / Spamhaus Technology Limited).
   - *Access Status & Blocker*: Legacy unauthenticated endpoint `https://urlhaus.abuse.ch/downloads/csv_recent/` returned HTTP 410 Gone. Active export downloads require an `Auth-Key` from `https://auth.abuse.ch/`.
   - *Threat-Type Constraint*: URLhaus primarily tracks malware distribution (`threat="malware_download"`). Generic malware URLs must NOT be labeled as phishing unless the source explicitly classifies or tags them as `phishing`.
3. **PhishTank (Cisco Talos Intelligence Group)**:
   - *License*: Free for non-commercial research use with attribution; commercial use requires a Talos agreement.
   - *Constraint*: Bulk data access requires an application key. Skipped per safety instructions.
4. **UCI PhiUSIIL (Isolated Benchmark)**:
   - *License*: Creative Commons Attribution 4.0 International (CC BY 4.0).
   - *Citation*: Prasad, A. & Chandra, S. (2024). *PhiUSIIL Phishing URL (Website) [Dataset]*. UCI Machine Learning Repository. DOI: 10.1016/j.cose.2023.103545.
   - *Constraint*: Isolated benchmark only; all 52 non-URL HTML/DOM features permanently discarded.

---

## 6. Training Suitability Assessment

### Is the current dataset ready for production model training?
**Verdict: Not yet suitable for supervised model training; suitable for internal benchmark & heuristic evaluation research only.**

**Rationale**:
1. **Missing Verified Phishing in Pilot Corpus**: Because PhishTank requires an API key and URLhaus legacy downloads returned HTTP 410 Gone while requiring an Auth-Key, the primary pilot corpus currently contains 988 `candidate_benign_domain` records and 0 verified phishing records. Training a supervised binary classifier requires balanced, verified positive samples.
2. **Tranco Asymmetry**: Tranco provides root domain strings (`http://domain.com/`). Training an ML model exclusively on Tranco domains without real-world benign subpaths risks teaching the classifier that any URL containing a path or query string is malicious.
3. **Public Suffix Library Requirement**: While our conservative heuristic handles common two-level ccTLDs (e.g. `.com.et`, `.gov.et`, `.co.uk`), deploying an authoritative PSL library (`tldextract`) is recommended before expanding to larger dataset scales.

---

## 7. Defined Evaluation Metrics & Goals (Pre-Training Baseline)

When an authorized training task is executed in the future, the classifier must be evaluated against these concrete metrics:

| Metric | Definition | Engineering Goal (To Be Measured, Not Claimed) |
| :--- | :--- | :--- |
| **Precision** | $\frac{TP}{TP + FP}$ | Minimize false accusations against clean sites. |
| **Recall** | $\frac{TP}{TP + FN}$ | Maximize detection of genuine phishing lures. |
| **Macro-F1** | $2 \cdot \frac{P \cdot R}{P + R}$ | Balanced evaluation across imbalanced test sets. |
| **False Positive Rate (FPR)** | $\frac{FP}{FP + TN}$ | **Goal: $\le 1.0\%$ on candidate benign traffic** (to prevent user alert fatigue). |
| **Confusion Matrix** | Breakdown of TP, FP, TN, FN | Detailed error analysis across domain families. |
| **Client-Side Model Size** | Exported JSON/binary weight artifact | **Goal: $\le 500\text{ KB}$** to maintain offline-first web bundle speed. |
| **Inference Latency** | Per-URL feature extraction + inference | **Goal: $\le 5\text{ ms}$** in client browser JavaScript engine. |

*Notice: All numerical targets above are design goals to be experimentally validated in future tasks, not claimed achievements.*

---

## 8. Next Steps Required Before Model Training

1. **Resolve Phishing Source Authorization**:
   - Option A: Register an organization application key at `phishtank.com` and configure `CYBERSHIELD_PHISHTANK_API_KEY`.
   - Option B: Obtain an `Auth-Key` from `auth.abuse.ch` for the URLhaus API v2 export endpoint.
   - Run the respective ingestion adapter to acquire up to 1,000 verified phishing URLs meeting strict criteria.
2. **Legal Review of Tranco Downstream Use**:
   - Complete formal terms review regarding Cloudflare Radar's CC BY-NC 4.0 component before any commercial distribution.
3. **Curate Observed Benign URLs with Paths**:
   - Supplement Tranco root domains with observed clean URLs (e.g., public documentation, educational portals, government sites) to provide realistic path and query distributions.
4. **Obtain Approval for `tldextract` Dependency**:
   - Request approval to install `tldextract` for 100% authoritative registered domain parsing.
5. **Execute Head-to-Head 3-Way Baseline Evaluation**:
   - Benchmark existing M1 heuristics alone vs ML alone vs Hybrid decision engine.

