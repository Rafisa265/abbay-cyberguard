# CyberShield Ethiopia — M1 URL Dataset Source Research & Readiness Audit

**Document Identifier:** `M1_URL_DATA_SOURCE_AUDIT.md`  
**Product:** CyberShield Ethiopia  
**Module:** M1 Link Scanner (Offline-First URL Classification Engine)  
**Research & Audit Date:** October 26, 2026  
**Auditor:** Antigravity AI Coding Assistant  
**Status:** Complete / Final Research Report (Read-Only Audit Phase)

---

## 1. Executive Summary

This document provides a comprehensive, read-only research audit of potential phishing and legitimate URL data sources for the CyberShield Ethiopia M1 Link Scanner. The primary objective is to evaluate data quality, label veracity, licensing terms, and technical feasibility for expanding the pilot dataset into a robust, leakage-free binary classification corpus.

### Key Audit Findings:
1. **Current Local Inventory Confirmed:** The local repository contains **988 accepted candidate benign domains** in [`data/m1_url_pilot/cleaned/pilot_corpus.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/cleaned/pilot_corpus.jsonl), partitioned into deterministic, leakage-free train (693), validation (154), and test (141) splits, plus 12 quarantined multi-tenant platforms. The pilot corpus contains **0 verified phishing records**.
2. **Benchmark Isolation Invariant Maintained:** The 1,000-record UCI PhiUSIIL sample ([`data/m1_url_pilot/splits/benchmark_phiusiil.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/splits/benchmark_phiusiil.jsonl)) remains strictly isolated as an external evaluation benchmark and must not be merged into training or validation splits.
3. **Core Asymmetry Flagged:** Tranco provides **popular domain names** rather than full benign URLs. Training a classifier on root domains alone causes severe lexical bias (inducing models to falsely classify any URL with a path or query string as phishing).
4. **Recommended Positive Source:** **LegitPhish (Potpelwar et al., 2025; Mendeley Data / Data in Brief, CC BY 4.0)** offers 101,219 annotated URLs with full paths. It provides the most viable, license-permissive, and immediate academic source for training samples, provided raw URLs are extracted, pre-computed lexical features are discarded, labels are re-coded, and source overlaps are filtered.
5. **Threat Feed Boundaries:** PhishTank and URLhaus require authentication credentials and have strict licensing/threat-type boundaries (URLhaus primarily tracks malware downloads, not credential phishing). OpenPhish Community Feed strictly prohibits commercial use and security operational deployments.
6. **Zero Impact on Production:** No external URLs were contacted or crawled, no API keys were configured, no datasets were regenerated, and no application code was modified during this audit.

---

## 2. Current Local Dataset Inventory & Limitations

The actual dataset files located under `data/m1_url_pilot/` were directly inspected and verified byte-by-byte:

| Artifact Path | Format | Record Count | File Size (Bytes) | Class Breakdown / Status |
| :--- | :---: | :---: | :---: | :--- |
| [`cleaned/pilot_corpus.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/cleaned/pilot_corpus.jsonl) | JSONL | **988** | 533,861 | 988 `candidate_benign_domain` (0 phishing). Cleaned Tranco Top 1,000 domains. |
| [`cleaned/pilot_corpus.summary.json`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/cleaned/pilot_corpus.summary.json) | JSON | 1 summary | 1,673 | Audit metrics: 2,000 raw input, 988 accepted, 12 quarantined, 1,000 benchmark. |
| [`splits/train.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/splits/train.jsonl) | JSONL | **693** | 376,601 | 70.1% partition. 693 unique registered domains. |
| [`splits/val.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/splits/val.jsonl) | JSONL | **154** | 83,263 | 15.6% partition. 154 unique registered domains. |
| [`splits/test.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/splits/test.jsonl) | JSONL | **141** | 76,512 | 14.3% partition. 141 unique registered domains. |
| [`splits/benchmark_phiusiil.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/splits/benchmark_phiusiil.jsonl) | JSONL | **1,000** | 602,583 | 500 legitimate, 500 phishing (845 unique domains). **Strictly isolated benchmark.** |
| [`quarantine/quarantined_records.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/quarantine/quarantined_records.jsonl) | JSONL | **12** | 7,054 | 12 high-abuse multi-tenant roots (`google.com`, `bit.ly`, `github.io`, etc.). |
| [`manifests/provenance_audit.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/manifests/provenance_audit.jsonl) | JSONL | **13** | 4,300 | Immutable, fingerprint-deduplicated provenance audit events. |
| [`manifests/source_manifest.json`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/manifests/source_manifest.json) | JSON | 5 sources | 5,976 | Documented metadata for Tranco, PhishTank, URLhaus, PhiUSIIL, Mozilla PSL. |
| [`resources/public_suffix_list.dat`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/resources/public_suffix_list.dat) | DAT | 10,397 rules | 338,012 | Pinned Mozilla PSL snapshot (`0232f4df08319113...`; MPL-2.0). |

### Current Limitations of Local Corpus:
1. **Severe Class Imbalance:** The pilot corpus contains **988 benign candidates and 0 phishing URLs**. Supervised machine learning cannot be trained until positive-class ingestion is executed.
2. **Domain vs. Full URL Asymmetry:** Tranco records provide root domains (`http://example.com/`). Training a model on Tranco domains teaches the model that clean sites never contain paths or query strings, causing high false-positive rates on legitimate deep links.
3. **Candidate Status vs. Ground Truth:** High traffic rank in Tranco signifies popularity, not an absolute guarantee that every subpath or hosted user content is benign.

---

## 3. Candidate Source Comparison Matrix

| Source Name | Publisher / Host | Primary Data Type | Stated Volume | License & Commercial Terms | API Key / Auth Required? | Recommended Role |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **LegitPhish** | R. S. Potpelwar et al. (*Data in Brief* / Mendeley) | Phishing + Legitimate URLs with full paths | 101,219 URLs (63,678 phish, 37,540 benign) | Creative Commons Attribution 4.0 (CC BY 4.0) | None (Public Download) | **Primary Training & Validation Ingestion** |
| **PhishTank** | Cisco Talos Intelligence Group | Active verified phishing URLs | ~10k–30k active; millions historical | Free for non-commercial research; commercial requires Talos agreement | **Yes** (Developer App Key) | **Secondary Verification & Freshness Ingestion** |
| **URLhaus** | abuse.ch AG / Spamhaus Technology Limited | Malware distribution URLs (occasional phishing) | 100k+ active malware URLs | abuse.ch Terms (Oct 2026); Not-for-profit Fair Use only. Paid Spamhaus sub for commercial. | **Yes** (`Auth-Key` from `auth.abuse.ch`) | **Strictly Filtered Auxiliary Ingestion** (`threat="phishing"`) |
| **UCI PhiUSIIL** | A. Prasad & S. Chandra (Computers & Security / UCI) | Phishing + Legitimate URLs with DOM features | 235,795 URLs (134,850 phish, 100,945 benign) | Creative Commons Attribution 4.0 (CC BY 4.0) | None (Public Archive) | **Isolated External Evaluation Benchmark** |
| **Tranco** | V. Le Pochat et al. (NDSS 2019 / KU Leuven) | Domain popularity ranking (composite) | Top 1M domains daily | Composite license; Cloudflare Radar is CC BY-NC 4.0. Requires legal review for commercial use. | None (Public List ID) | **Candidate Benign Root Domain Baseline** |
| **OpenPhish** | OpenPhish, Inc. | Active phishing URLs | ~500–2,000 active in free community feed | **Strictly Non-Commercial**. Explicitly bans security ops, detection, productization. | None for community feed; Premium requires contract | **NOT Suitable for Commercial / Product Pipeline** |
| **Hannousse & Yahiouche** | A. Hannousse & S. Yahiouche (EAAI 2021 / Mendeley) | Balanced phishing + benign URLs | 11,430 URLs (5,715 phish, 5,715 benign) | Creative Commons Attribution 4.0 (CC BY 4.0) | None (Public Download) | **Auxiliary Offline Benchmark / Validation Set** |
| **APWG eCrimeX** | Anti-Phishing Working Group (APWG) | High-confidence phishing URLs & threat telemetry | Multi-million authoritative repository | Proprietary / Data Sharing Agreement (DSA) required. Researcher grants by application. | **Yes** (Member / Grant Credentials) | **Future Enterprise Tier / Gold Standard Ingestion** |

---

## 4. Source-by-Source Quality, Licensing, & Risk Analysis

### 4.1 LegitPhish (Potpelwar et al., 2025)
- **Official URL & Citation:** Hosted on Mendeley Data ([DOI: 10.17632/hx4m73v2sf.2](https://data.mendeley.com/datasets/hx4m73v2sf/2)). Accompanying paper: *LegitPhish: A large-scale annotated dataset for URL-based phishing detection*, *Data in Brief*, Vol. 63, August 2025, 111972.
- **Publisher:** Rachana S. Potpelwar, U. V. Kulkarni, J. M. Waghmare (Government College of Engineering, Nanded / SRTM University, India).
- **Data Type & Volume:** 101,219 full URLs (63,678 phishing URLs and 37,540 legitimate URLs).
- **Labeling & Verification:**
  - *Phishing:* Gathered from verified threat feeds (PhishTank and URLhaus).
  - *Legitimate:* Gathered using Google Search API across diverse topics and high-authority domains (e.g. Wikipedia), yielding full paths and query strings.
  - *Label Encoding:* `ClassLabel = 0` indicates Phishing; `ClassLabel = 1` indicates Legitimate.
- **Update Frequency & Age:** Static snapshot (Version 2 released May 2025).
- **Licensing & Terms:** Creative Commons Attribution 4.0 International (CC BY 4.0). Permits sharing and adaptation with attribution.
- **Known Risks & Caveats:**
  1. *Label Coding Trap:* Target label `0` is phishing and `1` is legitimate; an automated ingestor must explicitly invert this to match the pipeline's string labels.
  2. *Source Overlap:* Because phishing URLs originated from PhishTank and URLhaus, using LegitPhish for training while evaluating against live PhishTank introduces cross-source contamination unless deduplicated.
  3. *Engineered Features Overhead:* The CSV includes 17 pre-extracted features. M1 must discard all 17 features and parse only the raw `URL` column through M1's native PSL-based normalizer.
  4. *Underlying Feed Terms:* Although the Mendeley distribution is CC BY 4.0, downstream commercial users should recognize that underlying data came from community feeds.
- **Suitability:** **Highly Suitable** for initial positive-class training and balanced supervised learning.
- **Access Safety:** 100% safe to download the curated CSV metadata file without visiting target URLs.

---

### 4.2 PhishTank (Cisco Talos)
- **Official URL:** [`https://phishtank.org/`](https://phishtank.org/) / Developer Portal: [`https://phishtank.org/developer_info.php`](https://phishtank.org/developer_info.php)
- **Publisher:** Cisco Talos Intelligence Group.
- **Data Type:** Active and historical phishing URLs with verification metadata (`online_valid.json`, `online_valid.csv`).
- **Labeling & Verification:** Crowdsourced submissions verified by community consensus votes and automated Talos telemetry. Records include `verified == "yes"`, `verification_time`, `target` brand, and `online == "yes"`.
- **Update Frequency:** Hourly incremental updates; real-time submission stream.
- **Licensing & Terms:** Free for non-commercial research use with attribution: *"Data provided by PhishTank"*. Commercial use requires an explicit written agreement with Cisco Talos. Bulk API access requires a developer application key.
- **Known Risks:**
  1. *Rapid Churn:* Median active lifespan of phishing URLs is 4–24 hours; historical links are rapidly taken down.
  2. *Target Brand Bias:* Heavily skewed toward top-targeted brands (Microsoft, PayPal, Google, Apple, financial institutions).
  3. *Community Vote Errors:* Unverified submissions (`verified != "yes"`) contain false accusations; strict filtering is required.
  4. *Positive-Only:* Zero legitimate URLs are provided; cannot be used alone for training.
- **Suitability:** **Suitable** for acquiring verified positive phishing samples for training and validation, provided an authorized developer key is configured.
- **Access Safety:** 100% safe to fetch bulk JSON/CSV metadata via the authenticated API without visiting endpoints.

---

### 4.3 URLhaus (abuse.ch AG / Spamhaus)
- **Official URL:** [`https://urlhaus.abuse.ch/`](https://urlhaus.abuse.ch/) / API: [`https://urlhaus.abuse.ch/api/`](https://urlhaus.abuse.ch/api/)
- **Publisher:** abuse.ch AG (Bern University of Applied Sciences spin-off) in collaboration with Spamhaus Technology Limited.
- **Data Type:** Threat URLs distributing malware payloads (`threat="malware_download"`). Occasionally tags phishing campaigns.
- **Labeling & Verification:** Community submissions vetted by automated sandboxes, crawler analysis, and malware analyst reviews.
- **Update Frequency:** Continuous real-time updates.
- **Licensing & Terms:** abuse.ch Terms of Use (effective Nov 4, 2025; updated Oct 21, 2026). **NOT CC0**. Free for not-for-profit purposes under Fair Use Principles. Commercial use requires a paid Spamhaus data subscription. Database export downloads require an `Auth-Key` from `https://auth.abuse.ch/` (legacy unauthenticated CSV endpoints return HTTP 410 Gone).
- **Known Risks:**
  1. *Threat-Type Mismatch:* URLhaus is a **malware distribution database**, not a dedicated phishing feed. The vast majority of URLs point to binary droppers (`.exe`, `.elf`, `.sh`, `.zip`, `.dll`), not credential harvesting forms.
  2. *Label Contamination:* Ingesting generic URLhaus records as "phishing" corrupts the training objective. Records must be strictly filtered to `threat == "phishing"` or records containing `"phishing"` in the tag array.
- **Suitability:** **Conditionally Suitable** as a secondary feed ONLY when strict phishing tags are present; unsuitable as a general phishing corpus.
- **Access Safety:** 100% safe to parse CSV/JSON feeds via API key; strictly avoid visiting target links.

---

### 4.4 UCI PhiUSIIL Phishing URL Dataset (Prasad & Chandra, 2024)
- **Official URL:** UCI Machine Learning Repository ([Dataset ID 967](https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite)). Accompanying paper: *PhiUSIIL: A diverse and comprehensive dataset for phishing URL detection*, *Computers & Security*, Vol. 138, 2024, 103545.
- **Publisher:** Arvind Prasad and Shalini Chandra (Department of Computer Science & Engineering, Birla Institute of Technology, Mesra).
- **Data Type & Volume:** 235,795 URLs (100,945 legitimate and 134,850 phishing).
- **Labeling & Verification:** Phishing URLs collected from PhishTank and OpenPhish between March and April 2022. Legitimate URLs collected from Alexa Top Sites and Common Crawl.
- **Update Frequency & Age:** Static snapshot (March–April 2022).
- **Licensing & Terms:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Known Risks:**
  1. *Benchmark Contamination Invariant:* The repository already reserves a 1,000-record sample (`data/m1_url_pilot/splits/benchmark_phiusiil.jsonl`) as a **dedicated external benchmark**. Merging any part of PhiUSIIL into training data destroys its independence as a zero-shot evaluation benchmark.
  2. *Domain Overlap:* Shares 13 high-authority cloud/hosting domains with the Tranco pilot corpus (`amazonaws.com`, `appspot.com`, `free.fr`, `netlify.app`, etc.).
  3. *Discarded Features:* The raw dataset includes 52 HTML/DOM/runtime features that cannot be evaluated offline by an M1 link scanner and must be permanently ignored.
- **Suitability:** **Reserved Strictly as an Isolated Benchmark**. Must **NOT** be merged into training or validation splits.
- **Access Safety:** Safe to read from the existing local snapshot.

---

### 4.5 Tranco Research-Oriented Top Sites Ranking (Le Pochat et al., NDSS 2019)
- **Official URL:** [`https://tranco-list.eu/`](https://tranco-list.eu/)
- **Publisher:** Victor Le Pochat, Tom Van Goethem, Samaneh Tajalizadehkashani, and Wouter Joosen (KU Leuven / NDSS 2019).
- **Data Type & Volume:** Daily ranking of the Top 1,000,000 domains globally, derived from 30-day Dowdall aggregation across 5 underlying lists: Cisco Umbrella, Majestic, Farsight, CrUX, and Cloudflare Radar.
- **Labeling & Verification:**
  - *Domain Popularity Rank:* Indicates traffic volume, **NOT safety**.
  - *Label Status in Pipeline:* `candidate_benign_domain`.
- **Licensing & Terms:**
  - *Underlying Sources:* Cisco Umbrella (free), Majestic (CC BY 3.0), Farsight (free), CrUX (CC BY-SA 4.0), and Cloudflare Radar (CC BY-NC 4.0).
  - *Licensing Review Status:* `requires_legal_terms_review_for_commercial_use`. The Cloudflare Radar component is licensed under CC BY-NC 4.0 (Non-Commercial). Downstream commercial applicability cannot be claimed without legal review.
- **Known Risks:**
  1. *No Path Information:* Provides root domains only (`domain.com`).
  2. *Multi-Tenant Platform Vulnerability:* Popular hosting domains (`workers.dev`, `google.com`, `github.io`) are legitimate domains that frequently host malicious subpaths.
- **Suitability:** Suitable as a candidate benign domain baseline, but must be paired with deep URL paths.
- **Access Safety:** 100% safe to download text/CSV rankings.

---

### 4.6 OpenPhish (OpenPhish, Inc.)
- **Official URL:** [`https://openphish.com/`](https://openphish.com/)
- **Publisher:** OpenPhish, Inc.
- **Data Type:** Active phishing URLs.
- **Labeling & Verification:** Proprietary automated machine learning detection engine.
- **Update Frequency:** Free Community Feed refreshed every 12 hours.
- **Licensing & Terms:**
  - The Free Community Feed is subject to a **strict Non-Commercial License**.
  - The Terms of Use explicitly forbid: security operations, threat intelligence, product development, automated defense, or customer protection for commercial or business operations.
  - An Academic Use Program exists for accredited educational institutions, but prohibits sharing data with third parties.
- **Known Risks:**
  - Commercial use prohibition prevents integrating community data into any commercial or operational release of CyberShield Ethiopia.
  - The feed provides only live links (500–2,000 URLs), discarding historical samples.
- **Suitability:** **NOT Currently Suitable** for the CyberShield Ethiopia pipeline due to commercial-use restrictions and redistribution prohibitions.
- **Access Safety:** Safe to read documentation; do not visit feed URLs.

---

### 4.7 Hannousse & Yahiouche Benchmark (Mendeley Data / EAAI 2021)
- **Official URL:** Mendeley Data ([DOI: 10.17632/c2gw7fy2j4.3](https://data.mendeley.com/datasets/c2gw7fy2j4/3)). Paper: *Webpage phishing detection using URL and content features*, *Engineering Applications of Artificial Intelligence*, Vol. 104, 2021, 104373.
- **Publisher:** Abdelhakim Hannousse and Salima Yahiouche (University of Tebessa, Algeria).
- **Data Type & Volume:** 11,430 URLs (5,715 phishing and 5,715 legitimate).
- **Licensing & Terms:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Known Risks:** Relatively small sample size (11k URLs); collected in 2020; static snapshot.
- **Suitability:** Suitable as an auxiliary validation dataset or secondary benchmark.
- **Access Safety:** Safe to download static CSV metadata.

---

### 4.8 APWG eCrimeX (Anti-Phishing Working Group)
- **Official URL:** [`https://apwg.org/`](https://apwg.org/)
- **Publisher:** Anti-Phishing Working Group (APWG).
- **Data Type:** Authoritative, real-time cybercrime telemetry (phishing URLs, emails, brands, malicious IPs).
- **Labeling & Verification:** Gold-standard industry verified with explicit *Confidence Factors*.
- **Licensing & Terms:** Members-only repository. Governed by formal Data Sharing Agreements (DSA). Researcher Data Grants are available by formal application (`membership@apwg.org`).
- **Suitability:** High-value enterprise standard, but **currently blocked by membership and DSA prerequisites**.

---

## 5. Critical Conceptual & Practical Distinctions

### 5.1 Why a Domain Ranking List is NOT a Verified List of Benign URLs
1. **Popularity vs. Safety:** Domain rankings measure DNS resolution traffic and user visits. Attackers routinely leverage high-ranking cloud services, web hosting platforms, and content delivery networks (e.g. `firebaseapp.com`, `s3.amazonaws.com`, `drive.google.com`, `workers.dev`, `pages.dev`) to host phishing lures. A popular domain can and does host malicious subpaths.
2. **Lexical Asymmetry (The "Path Trap"):** Tranco provides bare root domains (`example.com` or `http://example.com/`). Real phishing attacks almost always contain subpaths, query tokens, and script filenames (`https://secure-login.domain.com/auth/login.php?session=xyz`). If an ML model is trained with root domains as "benign" and deep URLs as "phishing", the model learns to associate the presence of *any slash, query parameter, or file extension* with phishing, resulting in massive false-positive rates on normal web browsing.

### 5.2 Why Malware-Hosting Feeds are NOT Identical to Phishing Feeds
1. **Distinct Attack Objectives:** Malware distribution sites (such as those predominantly cataloged by URLhaus) aim to deliver malicious binary payloads (`.exe`, `.iso`, `.zip`, `.sh`, `.elf`) to compromise host operating systems. Phishing sites aim to steal credentials, session cookies, or financial information through social engineering and form impersonation.
2. **Distinct Lexical Patterns:** Phishing URLs frequently employ brand typosquatting (`paypa1.com`), deceptive subdomains (`microsoft.com.account-update.xyz`), and security keywords (`login`, `verify`, `secure`, `banking`). Malware URLs, conversely, frequently exploit vulnerable WordPress or Joomla sites, placing randomly named dropper files deep in directory structures (`/wp-content/uploads/2026/10/invoice_8482.zip`).
3. **Label Noise Consequences:** Treating malware download URLs as "phishing" pollutes the classification boundary, misleading feature weights for brand mimicking and credential lures.

### 5.3 Why a Historical Phishing Label Does NOT Guarantee a URL is Malicious Today
1. **Extreme Ephemerality:** Phishing campaigns have an average active lifespan of only 4 to 24 hours. Hosting providers, registrars, and cloud platforms rapidly suspend accounts, revoke DNS records, or take down malicious directories.
2. **Domain Recycled / Remediated:** When an attacker compromises an innocent small-business website (`bakery.com/wedding-cakes/phish/`), the webmaster cleans the site within days, leaving the URL returning HTTP 404 or redirecting to the legitimate homepage. If the domain expires, it may be purchased by a legitimate business.
3. **Dynamic Verification Limit:** A historical phishing URL cannot be verified dynamically today; querying live DNS or HTTP will show clean or dead responses. Offline link classifiers must therefore evaluate **lexical structure at time of acquisition**, not current live web state.

---

## 6. Compatibility Assessment with Current Pipeline & Schema

### Current Schema in `pilot_corpus.jsonl`
The pipeline currently tracks the following standard fields:
- `record_id`: Unique deterministic ID (e.g. `tranco:2:951206bc12fb`).
- `source`: Source identifier (`tranco`, `phishtank`, `urlhaus`, `uci_phiusiil`).
- `source_record_id`: Row number or upstream ID.
- `source_snapshot`: Identifier of snapshot or feed list.
- `acquired_at`: UTC ISO timestamp of acquisition.
- `raw_url`: Original raw input string.
- `normalized_url`: Canonicalized URL (scheme, lower host, default port stripped, fragment stripped).
- `registered_domain`: PSL-resolved registrable domain (eTLD+1).
- `subdomain`: Subdomain labels or `None`.
- `tld`: Suffix or `None`.
- `has_ip_host`: Boolean flag for IPv4/IPv6 host.
- `has_userinfo`: Boolean flag for userinfo component.
- `has_punycode`: Boolean flag for IDN/punycode.
- `label`: `candidate_benign_domain`, `phishing`, `quarantine`.
- `label_status`: `candidate`, `verified`, `unverified`.
- `verification_status`: Specific verification basis.
- `split`: `train`, `val`, `test`, `quarantine`, `benchmark`, or `None`.
- `quarantine_reason`: Reason for exclusion, if quarantined.
- `original_label`: Pre-quarantine source label.

### Recommended Schema Extensions for Multi-Source Binary Ingestion
To support candidate sources (specifically LegitPhish and future PhishTank/URLhaus feeds), the following optional fields are recommended for inclusion in a future schema migration:

```json
{
  "target_brand": "paypal",
  "threat_type": "credential_phishing",
  "original_data_type": "full_url",
  "collection_method": "academic_corpus",
  "licensing_review_status": "cc_by_4_0"
}
```

*Note: In accordance with project boundaries, no schema changes have been implemented during this audit.*

---

## 7. Staged Plan for Future Binary-Classification Dataset Preparation

The following 8-stage engineering plan outlines the safe, reproducible path to build an operational binary-classification dataset when explicitly approved:

```
+---------------------------------------------------------------------------------------+
|                                    STAGED DATA PLAN                                   |
+---------------------------------------------------------------------------------------+
| Stage 1: Legal & Licensing Clearance (Approve CC BY 4.0 LegitPhish; clarify Tranco)   |
|                                          |                                            |
| Stage 2: Benign Deep-URL Remediation (Supplement Tranco root domains with full URLs)  |
|                                          |                                            |
| Stage 3: Controlled Acquisition of LegitPhish (Sample 5k–10k raw URLs; drop features) |
|                                          |                                            |
| Stage 4: Deduplication & Conflict Quarantine (Deduplicate; quarantine label conflicts)|
|                                          |                                            |
| Stage 5: Domain-Grouped Splitting (Authoritative Mozilla PSL; enforce 0% leakage)     |
|                                          |                                            |
| Stage 6: Class Balance & Feature Distribution Audit (Enforce 50:50 or 60:40 ratio)   |
|                                          |                                            |
| Stage 7: Isolated External Benchmark Evaluation (Evaluate on UCI PhiUSIIL)            |
|                                          |                                            |
| Stage 8: Provenance Logging & Fingerprinting (Append idempotent provenance records)  |
+---------------------------------------------------------------------------------------+
```

### Stage 1: Source Approval & Legal Clearance
- Obtain formal approval to use **LegitPhish (CC BY 4.0)** for academic/research dataset preparation.
- Confirm exclusion of OpenPhish Community feed due to commercial productization restrictions.

### Stage 2: Benign Deep-URL Remediation
- Supplement Tranco's root domains with full benign URLs with deep paths and query parameters (e.g. from Wikipedia top articles and government open-data portals) to eliminate lexical path asymmetry.

### Stage 3: Controlled Acquisition of LegitPhish Sample
- Download `legitphish_v2_sample.csv` (Mendeley Data DOI `10.17632/hx4m73v2sf.2`) into gitignored `data/m1_url_pilot/raw/`.
- Discard all 17 pre-computed feature columns.
- Re-code class labels: `0` $\to$ `phishing` (`label_status="candidate"`), `1` $\to$ `observed_legitimate_url` (`label_status="verified"`).
- Pass raw URLs through `data/m1_url_pilot/pipeline/normalize.py`.

### Stage 4: Deduplication & Conflict Quarantine
- Execute `deduplicate_records()` across the combined corpus.
- If any URL appears with conflicting labels across sources (e.g. phishing in LegitPhish and benign in Tranco), quarantine both records with `CONFLICTING_SOURCE_LABELS`.

### Stage 5: Domain-Grouped Splitting
- Partition accepted records into Train (70%), Validation (15%), and Test (15%) splits strictly by registered domain using [`split_domains.py`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/pipeline/split_domains.py).
- Enforce: $\text{Train Domains} \cap \text{Val Domains} = \emptyset$, $\text{Train Domains} \cap \text{Test Domains} = \emptyset$, $\text{Val Domains} \cap \text{Test Domains} = \emptyset$.

### Stage 6: Class Balance & Distribution Audit
- Balance training and validation sets to a 1:1 or 60:40 benign-to-phishing ratio.
- Audit distributions of URL length, path depth, HTTPS ratio, and TLDs to ensure no synthetic bias is introduced.

### Stage 7: Independent Benchmark Evaluation
- Maintain `benchmark_phiusiil.jsonl` strictly isolated.
- Evaluate trained M1 models on PhiUSIIL as a zero-shot out-of-distribution benchmark.
- Exclude overlapping domains from evaluation.

### Stage 8: Idempotent Provenance Logging
- Record acquisition fingerprints, raw counts, accepted counts, and snapshot IDs into [`manifests/provenance_audit.jsonl`](file:///d:/CyberShield-Ethiopia/data/m1_url_pilot/manifests/provenance_audit.jsonl) using stable SHA-256 event fingerprints.

---

## 8. Unresolved Questions & Risk Matrix

| Risk / Question | Severity | Impact | Mitigation Strategy |
| :--- | :---: | :--- | :--- |
| **Tranco CC BY-NC 4.0 Component** | Medium | Downstream commercial product deployment might be contested due to Cloudflare Radar ranking component. | Seek legal terms review; if needed, filter Tranco to Umbrella/Majestic components or replace with open common-crawl domains. |
| **LegitPhish Feed Derivation** | Low–Medium | LegitPhish contains URLs sourced from PhishTank/URLhaus. | Dataset compiler published under CC BY 4.0 in *Data in Brief*; provide full attribution and paper citation. |
| **PhishTank / URLhaus Key Barrier** | Low | Cannot fetch live automated updates without configuring developer keys. | Use static curated datasets (LegitPhish) for initial model development; add API keys only if live feeds are authorized. |
| **Domain-Level Leakage Across Suffixes** | Low (Mitigated) | Multi-tenant subdomains (e.g. `user1.github.io` vs `user2.github.io`) could leak across splits. | Fully mitigated by M1's Mozilla PSL engine using `include_private=True`. |
| **Benchmark Contamination** | High | Accidental merging of PhiUSIIL into training data would invalidate independent evaluation. | Hardcoded pipeline barriers and unit test assertions prevent merging benchmark records. |

---

## 9. Citations & Evidence Links

1. **LegitPhish Dataset & Paper:**
   - Potpelwar, R. S., Kulkarni, U. V., & Waghmare, J. M. (2025). *LegitPhish: A large-scale annotated dataset for URL-based phishing detection*. *Data in Brief*, Vol. 63, 111972. [DOI: 10.1016/j.dib.2025.111972](https://doi.org/10.1016/j.dib.2025.111972).
   - Mendeley Data Repository: [DOI: 10.17632/hx4m73v2sf.2](https://data.mendeley.com/datasets/hx4m73v2sf/2).
2. **UCI PhiUSIIL Dataset & Paper:**
   - Prasad, A., & Chandra, S. (2024). *PhiUSIIL: A diverse and comprehensive dataset for phishing URL detection*. *Computers & Security*, Vol. 138, 103545. [DOI: 10.1016/j.cose.2023.103545](https://doi.org/10.1016/j.cose.2023.103545).
   - UCI Machine Learning Repository: [`https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite`](https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite).
3. **Tranco Top Sites Ranking & Paper:**
   - Le Pochat, V., Van Goethem, T., Tajalizadehkashani, S., & Joosen, W. (2019). *Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation*. In *Proceedings of the 26th Annual Network and Distributed System Security Symposium (NDSS 2019)*.
   - Tranco List Portal: [`https://tranco-list.eu/`](https://tranco-list.eu/).
4. **PhishTank (Cisco Talos):**
   - Developer Portal & API Terms: [`https://phishtank.org/developer_info.php`](https://phishtank.org/developer_info.php).
5. **URLhaus (abuse.ch AG / Spamhaus):**
   - Terms of Use (Effective Nov 4, 2025 / Updated Oct 21, 2026): [`https://abuse.ch/terms-of-use/`](https://abuse.ch/terms-of-use/).
   - API Documentation: [`https://urlhaus.abuse.ch/api/`](https://urlhaus.abuse.ch/api/).
6. **OpenPhish:**
   - Community Feed Terms of Use: [`https://openphish.com/terms.html`](https://openphish.com/terms.html).
7. **Hannousse & Yahiouche Benchmark & Paper:**
   - Hannousse, A., & Yahiouche, S. (2021). *Webpage phishing detection using URL and content features*. *Engineering Applications of Artificial Intelligence*, Vol. 104, 104373. [DOI: 10.1016/j.engappai.2021.104373](https://doi.org/10.1016/j.engappai.2021.104373).
   - Mendeley Data: [DOI: 10.17632/c2gw7fy2j4.3](https://data.mendeley.com/datasets/c2gw7fy2j4/3).
8. **Mozilla Public Suffix List:**
   - Official Repository & Snapshot: [`https://publicsuffix.org/`](https://publicsuffix.org/).
   - License: Mozilla Public License 2.0 (MPL-2.0).

---

## 10. Audit Verification & Final Recommendation

### Boundary Adherence Confirmation:
- **No data was downloaded, scraped, or appended.**
- **No URLs were contacted, crawled, or probed.**
- **No API keys were requested or exposed.**
- **`.env`, database schemas, PostgreSQL databases, and backups (`D:\CyberShield-Ethiopia.zip`) were not touched.**
- **The Mozilla PSL snapshot (`0232f4df...`) and existing splits were not modified.**
- **PhiUSIIL benchmark remains 100% isolated.**

### Final Recommendation:
**Proceed to a separately approved, small-scale acquisition plan focusing on LegitPhish (Phase 1).**

Do **not** initiate automated ingestion or dataset regeneration until the user explicitly reviews this audit report and approves the staged plan.
