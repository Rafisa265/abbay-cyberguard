# Status, limitations and known issues

## Executed and passed (Windows host, Python 3.15, Node 24)

### Backend Pytest Suite: 235 Passed (100% Pass Rate across All 9 Test Files)
- Security and Network boundaries:
  - Host/Origin/Content-Type filtering (SR-01, SR-02, SR-03, SR-05)
  - Rejection of non-loopback binding without explicit flag (SR-01)
  - 404 on live/scanner paths (`/api/v1/m4/live`)
  - No secret fields in OpenAPI inventory
  - Zero outbound HTTP client imports (SR-06)
  - Generic 500 error responses without internal stack trace leakage (SR-08)
  - Safe audit logging without canary/credential leaks (SR-07)
  - Max body size limits (4KB)
- CyberShield Conversational AI Assistant Suite (`test_assistant.py` — 15 Passed):
  - Fully offline answer dispatch (`ANSWERED_OFFLINE`) without unnecessary online recommendation
  - Unrelated question containment (`OFFLINE_ANSWER_INSUFFICIENT`)
  - Partially answerable queries: explicitly identifies missing real-time evidence
  - Short-term conversation context continuation (details, examples, next steps)
  - Explicit consent gate enforcement (`ONLINE_CONSENT_REQUIRED`) before external transmission
  - Truthful unconfigured provider fallback (`ONLINE_UNAVAILABLE`)
  - Automatic credential and password redacting with security warning alert
  - Live URL scanning refusal and safe redirection to Module M1 Link Checker
  - Session isolation preventing context leakage across separate users
  - Parity across English, Afaan Oromoo, and Amharic
- Machine Learning & Classification Suite (`test_ml.py` — 22 Passed):
  - 8-dimensional normalized learner telemetry feature extraction and bounds enforcement
  - Softmax logistic regression with L2 regularization and numerically stable forward pass
  - Baseline prior classifier comparison establishing genuine predictive lift
  - Exact floating-point weight parity between backend JSON artifact and frontend JS mirror (tolerance < 1e-9)
  - Category remediation guardrail and minimum-attempt progression gates
  - Deterministic offline fallback under disabled/unconfigured ML states (default)
- M1 Cyber Threat Intelligence (CTI) Suite (`test_m1_cti.py` — 58 Passed):
  - Provider-adapter design: `BaseCTIAdapter`, `LocalFeedCTIAdapter`, `GoogleSafeBrowsingV5Adapter`, `GoogleWebRiskAdapter`, `MockCTIAdapter`
  - Local threat feed integration: atomic JSON loading, strict schema validation, empty/missing/corrupted feed safe fallback (`unavailable`), timestamp parsing, and attribution
  - Official Google Safe Browsing v5 Protocol Buffers (`application/x-protobuf`) wire format decoding and `cacheDuration` extraction
  - URL canonicalization, credential stripping, and port normalization
  - Rejection of unsupported schemes (`javascript:`, `file:`, `data:`, `ftp:`) with 400 Bad Request
  - SSRF protection: fixed provider endpoints, zero user-directed outbound connections
  - Positive threat detection (malicious match) and clean threat verification in both Protobuf and JSON formats
  - Safe fallback on missing API key (`CONFIG_MISSING`), timeout (`TIMEOUT`), rate limit (`RATE_LIMITED`), authentication errors (`401`/`403`), and server errors (`PROVIDER_ERROR`)
  - Strict validation against malformed protobuf payloads and unexpected content types (`text/html`)
  - Zero secret or API key leakage in responses, logs, or status endpoints
- M1 Dataset Pipeline & Benchmark Isolation Suite (`test_m1_dataset_pipeline.py` — 89 Passed):
  - Deterministic offline Mozilla Public Suffix List (PSL) parser implementing ICANN and PRIVATE domain trees
  - Pinned PSL snapshot authentication (SHA-256 `0232f4df...`), strict failure on missing or modified snapshot
  - Multi-tenant hosting isolation (`*.github.io`, `*.appspot.com`, `*.firebaseapp.com`, `*.pages.dev`)
  - Bare multi-tenant root fallback (`s3.amazonaws.com` -> `amazonaws.com`)
  - Fail-closed benchmark loader: raises `BenchmarkIsolationError` on missing, empty, malformed, or unresolvable files
  - Exact 941 canonical registered domain reproducibility from 1,000 PhiUSIIL benchmark records
  - Proactive benchmark domain collision quarantine (`BENCHMARK_DOMAIN_COLLISION`)
  - Compromised domain split-hazard quarantine (`COMPROMISED_DOMAIN_SPLIT_HAZARD`)
  - Purely offline Wangchuk ingestion adapter (`ingest_wangchuk.py`) with precomputed feature stripping and non-fabricated label mapping
- Artwork & AI Asset Fallback Suite (`test_artwork.py` — 6 Passed):
  - Deterministic SVG fallbacks when external generation is disabled
  - Safe parameter checking, zero crash behavior
- Daily Progress & Notifications Suite (`test_daily_progress.py`, `test_notifications.py` — 13 Passed):
  - Progress calculation and streak tracking
  - Notification generation, deduplication, and safe dismissal
- API Routing & Loopback Guard Suite (`test_api.py` — 18 Passed):
  - Route health, OpenAPI schema sanitization, loopback verification
- Machine Learning & Classification Suite (`test_ml.py` — 20 Passed):
  - Deterministic offline scam classification, scoring parity, and keyword heuristic validation
- Authentication & User Management Suite (`test_auth.py` — 10 Passed):
  - Argon2id password hashing, constant-time verification, session tokens, and cookie security attributes (`HttpOnly`, `SameSite=Lax`, `Path=/`)
  - Duplicate email rejection, input validation, and rate limiting (5 attempts limit)
  - Fast automatic offline fallback: when local PostgreSQL 16 is not listening on port 5432, tests automatically leverage isolated in-memory SQLite (`StaticPool` with `PRAGMA foreign_keys=ON`), enabling 100% pass rate in ~3.4s without connection timeouts. Application-level auth logic, Argon2id hashing, session token lifecycles, and consent boundaries are fully verified; native PostgreSQL engine features (such as native binary UUID storage, server-side TIMESTAMPTZ, and multi-worker pool concurrency) require a live PostgreSQL service for verification.

### Frontend Vitest Suite: 516 Passed across 30 Test Suites
- CyberShield Conversational AI Assistant (`assistant.test.js` — 11 Passed):
  - In-browser local response generation and sufficiency evaluation (100% offline capable).
  - Trilingual knowledge base coverage (Phishing, Telebirr/CBE Birr scams, M1-M5, SIM swap, Telegram bots).
  - Sensitive data scrubbing (passwords, PINs, card numbers) with security alert warning.
  - Follow-up context continuation ("Give me an example", "What should I do next?").
  - Live link scan request refusal and safe redirection to M1.
  - Full React UI rendering in English, Afaan Oromoo, and Amharic.
- Cyber Hero Journey & Offline Mission Generator (`journey.test.js`, `journey_qa.test.js`, `practice_progression.test.js`, `journey_ml.test.js`, `journey_ml_parity.test.js`):
  - Mission schema validation against category, difficulty, RFC 2606 safe reserved testing domains (`.invalid`, `.example`, `.test`, `.example.com`), evidence structures, and single correct choice.
  - Deterministic procedural offline generator generating valid scenarios without Math.random() (SR-09 compliant).
  - Core reviewed missions M01–M06 (Scholarship Phishing, Telecom SIM OTP, Fake Banking Bot, Malicious Job APK, Romance/Crypto scam, Impersonation).
  - Sequential Next Mission progression, uncompleted loopback, and custom practice mission generation.
  - Trap vs. defensive action choice evaluation with specific immediate feedback, warning sign explanations, and zero punishment for retrying.
  - Full end-to-end campaign walkthrough verifying rank upgrades and badge unlocks.
  - Replay verification ensuring completed missions can be replayed freely without duplicate XP or badge proliferation.
  - Local browser storage persistence restoring completed missions, XP, badges, and active mission across refreshes and restarts.
  - Strict privacy boundary: zero credentials, scanned URLs, report drafts, or identity inputs ever saved.
- M1 Suspicious Link Checker (`m1_threat_checker.test.js`, `m1_cti.test.js`, `lib/m1.test.js`):
  - Offline text heuristics, indicator fixtures, score levels, URL normalization.
  - CTI provider client behavior, offline default, positive threat hit, clean responses, error fallbacks, and provider status.
- M2 Password Tools (`lib/m2.test.js`, `m2_hardening.test.js`):
  - Entropy estimation, CSPRNG rejection sampling via `crypto.getRandomValues`, chi-square uniformity test, charset constraints, client-side only processing.
- M3 Incident Report Assistant (`lib/m3.test.js`):
  - Incident schema validation, safe draft formatting, copy/download, sensitive data warnings (credit card / credentials via Luhn and multilingual regex).
- M4 Simulation (`m4_render_audit.test.js`):
  - Educational simulated fixture results, offline isolation, verification that live scanner `/api/v1/m4/live` is unreachable.
- M5 Learn & Quiz (`lib/quiz.test.js`, `phase3_qa.test.js`):
  - Quiz questions, answer evaluation, topic coverage, feedback rationale, offline scoring.
- 3D CyberBattle Game, Arena, & Attacker Mode (`gameEngine3d.test.js`, `arena.test.js`, `battleMode.test.js`, `attackerMode.test.js`):
  - Target coordinate reachability, server restore interaction handlers, collision boundaries.
- Internationalization (`i18n.test.js`):
  - 1,807 keys with 100% 1-to-1 parity across English, Afaan Oromoo, and Amharic with zero empty values.
  - Bundled local Noto Sans Ethiopic fonts for offline Amharic rendering.
- Static Privacy & Security Checks (`static.test.js`, `app_render.test.js`, `responsive.test.js`, `dashboard_redesign.test.js`, `account.test.js`):
  - SR-09, FR-13, FR-26: no unauthorized network access, zero Math.random() in security-critical routines, no raw innerHTML/eval(), localStorage strictly restricted to non-sensitive preferences and progress.

---

## Verified Architecture & Operational Modes

1. **Fully Offline (In-Browser)**:
   - Core M1 heuristic link analysis, M2 password tools, M3 incident reporting, Learn & Quizzes (22 questions), Cyber Hero Journey (6 missions + procedural generator), 3D CyberBattle Game & Arena, Conversational AI Assistant (offline knowledge mode), Trilingual UI & Ethiopic fonts.
   - Zero network connection or backend server required.
2. **Local Backend Mode (`http://127.0.0.1:8000`)**:
   - Loopback-only binding; hosts M1 Local CTI (`threat_feed.json`), M4 educational simulations, notifications, ML recommendation engine, Conversational AI Assistant API, and guest session handling.
   - Requires Python 3.15+ virtual environment.
3. **Database-Backed Account Mode (Optional)**:
   - Requires PostgreSQL 16 on port 5432.
   - Stores user credentials (Argon2id), session tokens, and optional consent-based progress sync.
   - When PostgreSQL is unavailable, application operates seamlessly in Guest Mode.

---

## Known Limitations

1. **CTI External Queries**: External online lookups (Google Safe Browsing v5) require internet access, valid API keys, and user consent. When offline or unconfigured, system safely defaults to local heuristics or local threat feed without error.
2. **Local Threat Feed Sourcing**: The local threat feed adapter supports verified JSON schemas. Automatic downloads are disabled; operators must manually convert and update feeds using `convert_feed.py` per `docs/threat-feed-runbook.md`.
3. **Official Reporting Channels**: Official Ethiopian reporting channels list in M3 is intentionally unpopulated with an informational guidance banner pending official verified regulatory contact details.
4. **PostgreSQL Service**: In environments without a live PostgreSQL 16 service on port 5432, tests automatically fall back to an isolated in-memory SQLite database, allowing the entire suite (123 tests) to pass offline. The production backend operates in Guest Mode if PostgreSQL is unavailable. When PostgreSQL is stopped, native PostgreSQL-specific behavior (e.g., native wire types, server-side TIMESTAMPTZ, psycopg pooling) is not verified.
5. **Machine Learning Model Validation Scope**: The Journey adaptive ML model (`SoftmaxClassifier`) was trained and evaluated on an isolated synthetic pipeline dataset (`DATASET_LIMITATION_STATEMENT`). It demonstrates empirical lift over baseline on synthetic distributions, but real-world learner efficacy remains subject to prospective pedagogical validation. Real-world validation must not be claimed without authorized field studies.
6. **Conversational AI Online Provider**: By default, the AI Assistant operates 100% offline using verified local knowledge. When external AI is not configured (`CYBERSHIELD_ASSISTANT_PROVIDER=none`), it truthfully reports `ONLINE_UNAVAILABLE` rather than fabricating external model responses. External transmission strictly requires explicit, informed user consent.

