# CyberShield Ethiopia — M1 URL Dataset Pilot Data Dictionary

**Document Version**: 1.0.0  
**Target Application**: CyberShield Ethiopia M1 Link Scanner (Offline-First URL Evaluator)  
**Classification**: Research & Evaluation Dataset Specification

---

## 1. Schema Overview

Every record in `cleaned/pilot_corpus.jsonl`, `splits/*.jsonl`, and `quarantine/*.jsonl` adheres to this canonical JSON schema. All fields are explicitly populated; missing or unavailable fields are set to `null` (or empty strings/booleans as defined below). Values are never invented or imputed.

| Field Name | Type | Allowed Values | Nullable? | Description |
| :--- | :--- | :--- | :--- | :--- |
| `record_id` | `string` | Unique identifier (e.g. `tranco:1:abc123456789`) | **No** | Stable, non-sensitive unique ID for the record. |
| `source` | `string` | `"tranco"`, `"phishtank"`, `"urlhaus"`, `"phiusiil_benchmark"`, `"synthetic_fixture"` | **No** | Identifies upstream data origin. |
| `source_record_id` | `string` | Source-specific ID or rank string (e.g., `"1"`) | Yes | Identifier from upstream source feed. |
| `source_snapshot` | `string` | e.g. `"tranco_W3ZV9_20261025"` | **No** | Exact snapshot/version identifier of the source. |
| `acquired_at` | `string` | ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) | **No** | Timestamp when the record was ingested into CyberShield. |
| `raw_url` | `string` | Raw unnormalized string | **No** | Original string exactly as acquired from source. |
| `normalized_url` | `string` | Canonical URL string | Yes | Canonicalized URL string after applying M1 normalization rules. `null` if malformed. |
| `registered_domain`| `string`| e.g. `"example.com"`, `"bank.et"` | Yes | Registered Pay-Level Domain (eTLD+1). `null` if IP address or malformed. |
| `subdomain` | `string` | e.g. `"login.portal"` | Yes | Subdomain component if present, or `null`. |
| `tld` | `string` | e.g. `"com"`, `"org"`, `"co.uk"`, `"gov.et"` | Yes | Top-level domain or multi-level ccTLD suffix. |
| `has_ip_host` | `boolean`| `true`, `false` | **No** | `true` if hostname is an IPv4 or IPv6 literal. |
| `has_userinfo` | `boolean`| `true`, `false` | **No** | `true` if credentials/userinfo were present in raw authority. |
| `has_punycode` | `boolean`| `true`, `false` | **No** | `true` if hostname contains `xn--` or IDN characters. |
| `label` | `string` | `"candidate_benign_domain"`, `"phishing"`, `"legitimate"`, `"quarantine"` | **No** | Assigned security classification label. |
| `label_status` | `string` | `"candidate"`, `"verified"`, `"unverified"`, `"synthetic"` | **No** | Verification confidence level of the label. |
| `verification_status`|`string`| e.g. `"tranco_ranked_pld"`, `"phishtank_community_verified"`, `"urlhaus_verified_phishing"` | **No** | Detailed evidence supporting the label status. |
| `split` | `string` | `"train"`, `"val"`, `"test"`, `"benchmark"`, `"quarantine"` | Yes | Partition assignment. Domain-grouped. |
| `quarantine_reason`| `string`| Specific reason string or `null` | Yes | Rationale if record was filtered or quarantined. |

---

## 2. Field Semantics & Source-Specific Availability

### 2.1 Tranco Source Records
- **`label`**: Strictly set to `"candidate_benign_domain"`.
  > [!IMPORTANT]
  > High Tranco rank reflects global domain query popularity, NOT proof that every path on that domain is safe. Tranco domains are never labeled as confirmed benign URLs.
- **`raw_url`**: Domain string from Tranco CSV (e.g., `google.com`).
- **`normalized_url`**: Formatted with default HTTP scheme and root path (e.g., `http://google.com/`).
- **Multi-Tenant Policy**: Top-ranked multi-tenant platforms (e.g., `google.com`, `github.io`, `bit.ly`, `pages.dev`, `ipfs.io`) are routed to `quarantine/` with reason `MULTI_TENANT_PLATFORM_NOT_UNIFORMLY_SAFE`.

### 2.2 PhishTank Source Records
- **`label`**: Set to `"phishing"`.
- **`label_status`**: Set to `"verified"`.
- **Verification Requirement**: Strictly accepted ONLY when upstream metadata indicates both `verified == "yes"` AND `online == "yes"`. All unverified submissions or offline records are quarantined.
- **Current Acquisition Note**: Live acquisition is skipped because no PhishTank API key is present in `.env`. Synthetic unit tests verify this parser.

### 2.3 URLhaus Source Records (abuse.ch AG / Spamhaus)
- **`label`**: Set to `"phishing"` only when `threat == "phishing"` or `"phishing"` is present in `tags`.
- **`label_status`**: Set to `"verified"`.
- **`verification_status`**: `"urlhaus_verified_phishing"`.
- **Malware vs Phishing Distinction**: URLhaus primary mission is tracking malware distribution (`malware_download`). Generic malware download URLs must NOT be labeled as phishing. Records with `threat != "phishing"` (e.g. Mirai, Mozi, ELF droppers, APK payloads) are quarantined with `URLHAUS_NON_PHISHING_MALWARE`.
- **Online Status Requirement**: Only records with `url_status == "online"` are eligible. Offline records are quarantined with `OFFLINE_URLHAUS_RECORD`.
- **Metadata**: Extended provenance preserved in `_metadata`: `dateadded`, `last_online`, `threat`, `tags`, `reporter`, `urlhaus_link`, and `content_checksum`.
- **Acquisition Status**: Live downloads via legacy endpoint returned HTTP 410 Gone; abuse.ch Terms of Use (effective Nov 2025 / updated Oct 2026) require an `Auth-Key`. No key is configured or fabricated. Parsers and filters are fully verified via synthetic unit test fixtures.

### 2.4 UCI PhiUSIIL Benchmark Records
- **`split`**: Always set to `"benchmark"`. Never mixed into the pilot training or validation corpus.
- **Excluded Features**: PhiUSIIL contains 54 features. 52 features related to HTML, DOM, Javascript, images, CSS, page titles, and popups are permanently discarded to preserve the offline URL-string-only constraint.
- **`label`**: Mapped from integer class:
  - `0` $\to$ `"phishing"`
  - `1` $\to$ `"legitimate"`
- **`label_status`**: `"verified"` (based on curated academic benchmark).

---

## 3. Public Suffix & Domain Grouping Architecture

### 3.1 Authoritative Mozilla Public Suffix List (PSL)
The M1 URL pipeline uses a deterministic, offline-first implementation of the Mozilla Public Suffix List, replacing legacy static heuristics:
- **Snapshot Resource**: Pinned local snapshot located at `data/m1_url_pilot/resources/public_suffix_list.dat`.
- **Integrity Verification**: Verified at runtime against SHA-256 hash `0232f4df0831911356e8ee1f4d5c3b6b12c0ed3f6bd66b0f81c8ab5d3d49e9ca` (Version `2026-10-22_08-36-41_UTC`, Commit `8437e5262f13305f94087abe699b4fe2be1d1de8`).
- **Zero Network Guarantee**: Operates 100% offline using a pure-Python trie parser (`data/m1_url_pilot/pipeline/psl.py`). Zero outbound network calls, zero DNS resolutions, zero external dependencies.
- **Fail-Fast Policy**: If the PSL resource is missing, corrupted, or has an unverified checksum, the pipeline raises `PSLResourceError` immediately. There is **zero silent fallback** to unverified heuristics.

### 3.2 ICANN vs. PRIVATE Rule Semantics
Mozilla's PSL is partitioned into two distinct sections:
1. **ICANN Domains (6,949 rules)**: Official top-level domains (gTLDs) and national ccTLD registries (e.g. `.com`, `.org`, `.et`, `.com.et`, `.gov.et`, `.co.uk`, `*.sch.uk`, `*.kawasaki.jp`, `!city.kawasaki.jp`).
2. **PRIVATE Domains (3,448 rules)**: Suffixes submitted by private organizations offering delegated subdomain hosting to independent third-party tenants (e.g. `github.io`, `pages.dev`, `workers.dev`, `firebaseapp.com`, `web.app`).

### 3.3 Domain Component Definitions
- **`public_suffix` (stored in `tld`)**: The longest matching public suffix rule under the PSL. For example, `com.et`, `co.uk`, `herts.sch.uk`, or `github.io`.
- **`registered_domain` (eTLD+1)**: The public suffix plus exactly one preceding organizational label (e.g. `cbe.com.et`, `bbc.co.uk`, `user.github.io`).
  - Set to `None` if the input is an IP address, localhost, or a public-suffix-only token (e.g. `com`, `co.uk`, `gov.et`).
- **`subdomain`**: Any label(s) preceding the `registered_domain` (e.g. `portal` in `portal.ethiopia.gov.et`), or `None` if no subdomain exists.

### 3.4 Dataset Splitting & Tenant Isolation Policy
For domain-grouped train/validation/test splitting (`split_domains.py`):
- **`include_private=True`**: Private suffixes are enforced. Distinct tenants under multi-tenant hosting platforms (e.g. `attacker.github.io` vs. `victim.github.io`) are decomposed into separate `registered_domain` values (`attacker.github.io` and `victim.github.io`). This allows separate tenant accounts to be partitioned and evaluated independently without falsely conflating them as a single organization.
- **Domain Hashing**: Splits are deterministically assigned via `assign_domain_split(registered_domain)` using SHA-256 modulo 100 (70% train, 15% validation, 15% test).
- **Leakage Invariant**: Strict assertion that `domain_sets["train"]`, `domain_sets["val"]`, and `domain_sets["test"]` have 0% intersection.

### 3.5 Candidate Benign vs. Verified URL Caution
- **Root-Domain Reputation Caveat**: Domains acquired from popularity rankings (such as Tranco) represent candidate root domains (`candidate_benign_domain`), not verified legitimate URLs.
- High popularity does not guarantee that arbitrary paths, user-generated subdomains, or open redirects hosted on the domain are benign.

### 3.6 Maintainer Update Procedure
To deliberately refresh the pinned PSL snapshot in a future maintenance cycle:
1. Run `python tools/update_psl_snapshot.py --check` to verify the current state.
2. Run `python tools/update_psl_snapshot.py --update --confirm-update` to fetch the latest official Mozilla snapshot.
3. Update `EXPECTED_PSL_SHA256`, `EXPECTED_PSL_VERSION`, and `EXPECTED_PSL_COMMIT` in `psl.py`.
4. Update `data/m1_url_pilot/manifests/source_manifest.json`.
5. Run full test verification: `pytest backend/tests/test_m1_dataset_pipeline.py`.
*Note: Snapshot updates are never performed automatically at runtime.*
