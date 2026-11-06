# ABBAY CYBERGUARD

> **Privacy-first, multilingual cybersecurity awareness and education platform.**  
> Built for citizens, students, civil servants, and digital users navigating modern online threats.

[![Frontend Tests](https://img.shields.io/badge/Frontend%20Tests-821%20Passed-success?style=flat-square&logo=vitest)](frontend/)
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-333%20Passed-success?style=flat-square&logo=pytest)](backend/)
[![Languages](https://img.shields.io/badge/Languages-English%20%7C%20Afaan%20Oromoo%20%7C%20%E1%8X%80%E1%8X%9B%E1%88%AD%E1%8X%9B-blue?style=flat-square)](#trilingual-localization)
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First%20%7C%20Zero--Telemetry-purple?style=flat-square)](#privacy--security-architecture)
[![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20FastAPI%20%2B%20PostgreSQL-orange?style=flat-square)](#system-architecture--tech-stack)

---

## Table of Contents

1. [Overview & Mission](#overview--mission)
2. [Core Educational Modules](#core-educational-modules)
3. [Gamified Learning & 3D Simulation](#gamified-learning--3d-simulation)
4. [Multilingual AI & Voice Assistant](#multilingual-ai--voice-assistant)
5. [Trilingual Localization](#trilingual-localization)
6. [Privacy & Security Architecture](#privacy--security-architecture)
7. [System Architecture & Tech Stack](#system-architecture--tech-stack)
8. [Repository Structure](#repository-structure)
9. [Prerequisites & Installation](#prerequisites--installation)
10. [Configuration & Environment Variables](#configuration--environment-variables)
11. [Offline Voice Models Setup](#offline-voice-models-setup)
12. [Automated Verification & Testing](#automated-verification--testing)
13. [Production Deployment](#production-deployment)
14. [Disclosures, Limitations & Ethics](#disclosures-limitations--ethics)
15. [Contributing & Responsible Disclosure](#contributing--responsible-disclosure)
16. [License & Acknowledgments](#license--acknowledgments)

---

## Overview & Mission

**ABBAY CYBERGUARD** is an open, privacy-preserving cybersecurity education ecosystem designed to demystify digital security for individuals and small organizations in Ethiopia and East Africa.

Digital transformation brings immense opportunity alongside rising threats: SMS phishing (smishing), mobile money account takeovers, social engineering, insecure Wi-Fi hotspots, and credential theft. ABBAY CYBERGUARD provides practical, hands-on, and accessible defense training directly in local languages without compromising user privacy.

### Guiding Principles

- **Zero-Telemetry Default**: Educational tools must not spy on learners. All primary scanning, password auditing, and learning tools execute entirely in the client browser.
- **True Offline Capability**: Core learning modules, 3D simulations, threat heuristics, and local AI triage work offline without requiring internet access.
- **Linguistic Equity**: Cybersecurity concepts are communicated natively in **English**, **Afaan Oromoo**, and **Amharic (አማርኛ)**, ensuring accessibility across communities.
- **Fail-Closed Security**: Production backend environments fail closed against insecure configurations, unencrypted connections, or missing database backends.

---

## Core Educational Modules

ABBAY CYBERGUARD provides five dedicated practical security tools and laboratories:

### M1: Threat Intelligence & Link Scanner
- **Local Heuristics Engine**: Evaluates URLs against homoglyph attacks, punycode spoofing, IP-based hosts, top-level domain anomalies, and high-entropy path patterns entirely client-side.
- **Domain Verification**: Uses Tranco top domain partitions and URLhaus Public Suffix List (PSL) rules.
- **Optional CTI Integration**: Pluggable Google Safe Browsing / Web Risk backend adapter with strict timeouts (default 4.0s) and fallback to heuristic evaluation if offline or unconfigured.

### M2: Password Security & Vault
- **Client-Side Cryptography**: Evaluates password strength, entropy bits, and crack-time estimates using Web Crypto API (`PBKDF2/SHA-256`).
- **Cryptographic Generator**: Employs uniform rejection-sampling PRNG (`crypto.getRandomValues`) to produce high-entropy, customizable passwords and passphrases.
- **Zero-Transmission Guarantee**: Passwords generated or tested never leave browser memory; they are never transmitted to any server or logged.

### M3: Incident Report Assistant
- **Interactive Triage**: Guided incident documentation for common scenarios: unauthorized account access, financial scams, harassment, malware infection, and lost devices.
- **Offline Text Classification**: Local Naive Bayes classifier assists in triaging incident urgency without cloud telemetry.
- **Actionable Guidance & Local Hotlines**: Provides step-by-step containment checklists and contact directories for Ethiopian Computer Emergency Response Team (ETHIO-CERT), INSA, and telecommunications operators.
- **Export & Privacy Barrier**: Report drafts are stored strictly in client storage; export is initiated only by explicit user command.

### M4: Website Security Learning Lab
- **Educational Simulation**: Interactive laboratory that visualizes how web protocols and server headers protect modern applications.
- **Deterministic Synthetic Fixtures**: Inspects simulated scenarios (Scenario A: Hardened enterprise portal; Scenario B: Misconfigured legacy site; Scenario C: Vulnerable unencrypted service).
- **Security Check Audits**: Evaluates TLS certificate validity, HTTP Strict Transport Security (HSTS), Content Security Policy (CSP), X-Frame-Options, and cookie flag posture (`HttpOnly`, `SameSite`, `Secure`).
- *Note: Operates strictly against isolated educational fixtures; does not perform intrusive scans against arbitrary third-party infrastructure.*

### M5: Academy & Certifications
- **Structured Curriculum**: Progressive cybersecurity courses covering fundamental hygiene, network safety, operational security, and social engineering defense.
- **Interactive Quizzes**: Real-time evaluation with contextual explanations.
- **Verifiable Localized Certificates**: Generates downloadable PDF certificates with localized typography and tamper-evident SHA-256 verification fingerprints.

---

## Gamified Learning & 3D Simulation

### Cyber Hero Journey
An adaptive, gamified journey guiding learners through progressive operational ranks (Initiate, Defender, Sentinel, Guardian, and Cyber Hero).
- **Adaptive Recommendations**: Privacy-preserving recommendation engine analyzes completed milestones to suggest relevant learning paths without tracking personal data.
- **Achievements & Badges**: Offline badge unlock system rewarding practical milestone completion.

### Digital City: Cyber War (3D Battlefield)
A real-time, browser-based tactical 3D cyber combat simulation built with **Three.js** and WebGL.
- **Squad Tactical Combat**: Friendly Defender units face off against hostile threat vectors (Malware Crawlers, DDoS Swarms, and Phishing Infiltrators).
- **Visual Combat Feedback**: Clear team identification, tactical health markers, 3D projectile trajectories, and spatial combat effects.
- **High Performance**: Optimized for 60 FPS rendering across both desktop and mobile platforms with dual-stick touch controls.
- **Minimap & Radar**: Real-time spatial tracking of friendly and hostile forces across the digital metropolis.

### Device Security Auditor
- **Hardware & OS Hardening Guide**: Step-by-step posture checks for desktop workstations and mobile smartphones.
- **Audit Checklists**: Screen lock timeout enforcement, disk encryption verification, biometric authentication setup, and application permission audits.

---

## Multilingual AI & Voice Assistant

### Conversational Security Assistant
- **Dual-Mode Intelligence**:
  - **Offline Intent Engine**: Instant, local keyword and semantic intent matcher resolving hundreds of common cybersecurity questions in English, Afaan Oromoo, and Amharic.
  - **Optional Cloud Provider**: Consent-gated Google Gemini API integration (`CYBERSHIELD_ASSISTANT_PROVIDER=gemini`) for advanced conversational queries. Requires explicit user opt-in before sending any text outside the local environment.

### Multilingual Voice Pipeline
- **Speech-to-Text (STT)**:
  - **English (`en`)**: Fast offline transcription via `whisper.cpp` (`ggml-small-q5_1.bin`).
  - **Amharic (`am`)**: Offline fine-tuned Whisper model (`b1n1yam/whisper-small-am`) running in an isolated worker subprocess.
- **Text-to-Speech (TTS)**:
  - **Amharic (`am`)**: Offline neural voice synthesis via Meta MMS (`facebook/mms-tts-amh`).
  - **Afaan Oromoo (`om`)**: Offline neural voice synthesis via Meta MMS (`facebook/mms-tts-gaz`).
  - **English (`en`)**: Zero-download browser-native Speech Synthesis API.
- **Privacy & Concurrency**:
  - Single-worker concurrency gate (`VoiceAdmissionController`) prevents CPU exhaustion.
  - Strict 2 MiB request body caps and canonical 16-bit 16 kHz mono WAV validation.
  - Zero audio persistence: audio buffers and temporary WAV files are unlinked immediately after processing.

---

## Trilingual Localization

ABBAY CYBERGUARD is localized from the ground up for the Ethiopian multilingual landscape:

| Language | Code | Script | Translation Status | Voice Support |
|---|---|---|---|---|
| **English** | `en` | Latin | 100% Verified | Offline STT (`whisper.cpp`) + Browser Native TTS |
| **Afaan Oromoo** | `om` | Qubee Latin | 100% Parity | Offline MMS-VITS TTS |
| **Amharic (አማርኛ)** | `am` | Ge'ez / Fidel | 100% Parity | Offline Whisper STT + Offline MMS-VITS TTS |

All localization strings maintain strict key parity verified by automated frontend unit tests. Custom typography ensures proper rendering of Ge'ez characters and Latin diacritics across mobile and desktop displays.

---

## Privacy & Security Architecture

### Dual-Mode Operation

```
+--------------------------------------------------------------------------+
|                            ABBAY CYBERGUARD                              |
+------------------------------------+-------------------------------------+
|         GUEST MODE (DEFAULT)       |        ACCOUNT MODE (OPTIONAL)      |
+------------------------------------+-------------------------------------+
| • No account or email required     | • Cross-device progress sync        |
| • 100% offline & client-side       | • Argon2id password hashing         |
| • Zero server telemetry            | • Revocable SHA-256 session tokens  |
| • LocalStorage isolated to browser | • SameSite=Lax / Strict cookies     |
| • Passwords never leave device     | • Explicit opt-in sync consent gate |
+------------------------------------+-------------------------------------+
```

### Security Engineering Standards

- **Password Hashing**: **Argon2id** (`time_cost=2`, `memory_cost=64MB`, `parallelism=1`, 32-byte hash) via `pwdlib`. Plaintext passwords are never stored, logged, or cached.
- **Session Security**: High-entropy cryptographically random session tokens stored as SHA-256 hashes in PostgreSQL; served via `HttpOnly`, `SameSite=Lax` (or `Strict`), and environment-controlled `Secure` cookies (`cybershield_session`).
- **Database Integrity**: Fail-closed database configuration in production. SQLite fallback is strictly prohibited in production mode.
- **Brute-Force Protection**: Sliding-window in-memory rate limiting across authentication endpoints.
- **Enumeration Defense**: Constant-time authentication responses with generic error messages preventing user enumeration.
- **Content Security & CORS**: Restrictive Cross-Origin Resource Sharing (CORS) bound to loopback and configured application origins.

---

## System Architecture & Tech Stack

```
                                  [ Browser / Client ]
                         +-----------------------------------+
                         |      React 18 + TypeScript        |
                         |  Tailwind CSS  |  Three.js WebGL  |
                         |  Web Crypto    |  Web Speech API  |
                         +-----------------+-----------------+
                                           | HTTP / REST
                                           v
                         +-----------------------------------+
                         |         FastAPI Backend           |
                         |     (Python 3.11+, Loopback)      |
                         +--------+-----------------+--------+
                                  |                 |
                   +--------------+                 +---------------+
                   v                                                v
       +-----------------------+                        +-----------------------+
       |     PostgreSQL 16     |                        |  Offline Voice Models |
       |  (Alembic Migrations) |                        |  (Whisper + MMS-VITS) |
       +-----------------------+                        +-----------------------+
```

### Technology Matrix

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Three.js (WebGL 3D engine), Lucide React icons, Vitest.
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2.0 Async, Alembic, Psycopg 3, Pytest.
- **Database**: PostgreSQL 16+ (fail-closed in production).
- **ML / AI Runtimes**: PyTorch, Hugging Face Transformers, `whisper.cpp`, MMS-VITS.

---

## Repository Structure

```
CyberShield-Ethiopia/
├── backend/
│   ├── alembic/              # Alembic database migrations and version scripts
│   ├── app/                  # FastAPI application package
│   │   ├── config.py         # Application settings and environment configuration
│   │   ├── database.py       # Async SQLAlchemy database session management
│   │   ├── models.py         # Database ORM models (User, Session, Progress)
│   │   ├── routes_auth.py    # Argon2id authentication & session endpoints
│   │   ├── routes_m4.py      # Website Security Lab simulation endpoints
│   │   ├── routes_ml.py      # Journey adaptive recommendation endpoints
│   │   ├── routes_voice.py   # Offline STT/TTS voice pipeline & status
│   │   ├── tts_service.py    # Offline neural TTS engine wrapper
│   │   └── main.py           # Application entrypoint & middleware pipeline
│   ├── tests/                # Automated pytest test suites (333 tests)
│   ├── requirements.txt      # Core Python production dependencies
│   ├── requirements-dev.txt  # Testing and development dependencies
│   └── run.py                # Local development server runner
├── frontend/
│   ├── src/                  # React application source code
│   │   ├── components/       # Shared UI components and modals
│   │   ├── i18n/             # Multilingual translation dictionaries (EN, OM, AM)
│   │   ├── modules/          # Core modules: M1, M2, M3, M4, M5, Journey, Digital City
│   │   └── services/         # Client-side crypto, CTI, and API connectors
│   ├── tests/                # Automated Vitest test files (821 tests)
│   ├── package.json          # Node dependencies and build scripts
│   └── vite.config.ts        # Vite configuration and build targets
├── .gitignore                # Git exclusions (models, backups, databases, secrets)
├── setup.bat                 # Windows one-click environment setup script
├── start.bat                 # Windows one-click development startup script
└── README.md                 # Project documentation
```

---

## Prerequisites & Installation

### System Requirements

- **Operating System**: Linux, macOS, or Windows 10/11
- **Python**: Version 3.11 or newer
- **Node.js**: Version 20 LTS or newer (`npm` 10+)
- **PostgreSQL**: Version 16 or newer (optional for client-only exploration, required for backend account features)

---

### Quickstart (Windows)

For rapid local setup on Windows, use the automated batch scripts:

```cmd
:: 1. Clone the private repository
git clone https://github.com/Rafisa265/abbay-cyberguard.git
cd abbay-cyberguard

:: 2. Run one-time setup (creates virtualenv, installs dependencies, builds frontend)
setup.bat

:: 3. Launch application server
start.bat
```
Navigate to **http://127.0.0.1:8000** in your browser.

---

### Manual Setup (Cross-Platform)

#### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate      # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt -r requirements-dev.txt

# Configure environment variables
cp ../.env.example ../.env     # Edit .env with your PostgreSQL credentials
```

#### 2. Database Migration

Ensure PostgreSQL is running and your target database exists:

```bash
# Create development database
createdb -h 127.0.0.1 -p 5432 -U postgres cybershield_dev

# Run Alembic migrations to latest schema
alembic upgrade head
```

#### 3. Frontend Setup

```bash
cd ../frontend

# Install Node dependencies
npm ci

# Run development server (runs with hot reload on port 5173)
npm run dev

# Or compile production bundle
npm run build
```

#### 4. Run Application

To serve the built frontend directly through FastAPI on port 8000:

```bash
cd ../backend
python run.py
```
Open **http://127.0.0.1:8000** in your browser.

---

## Configuration & Environment Variables

Configuration is loaded from `.env` in the repository root.

> **Note on Variable Naming**: For backward compatibility and stability across deployments, internal environment variable keys retain the `CYBERSHIELD_*` prefix.

| Variable | Default Value | Description |
|---|---|---|
| `CYBERSHIELD_BIND` | `127.0.0.1` | Loopback bind address (refuses non-loopback unless explicitly permitted) |
| `CYBERSHIELD_PORT` | `8000` | Port for FastAPI application server |
| `CYBERSHIELD_ALLOW_NON_LOOPBACK` | `false` | Security guard preventing accidental public exposure |
| `DATABASE_URL` | `postgresql+psycopg://...` | PostgreSQL connection string for development and production |
| `TEST_DATABASE_URL` | `postgresql+psycopg://...` | Isolated PostgreSQL database used strictly for test execution |
| `CYBERSHIELD_SECRET_KEY` | *(Random secret)* | Cryptographic key for session token HMAC signing |
| `CYBERSHIELD_SESSION_LIFETIME_HOURS` | `24` | Session token validity duration in hours |
| `CYBERSHIELD_COOKIE_SECURE` | `false` | Enforce `Secure` flag on cookies (set to `true` on HTTPS deployments) |
| `CYBERSHIELD_RATE_LIMIT_ENABLED` | `true` | Enables sliding-window rate limiting on sensitive auth routes |
| `CYBERSHIELD_CTI_PROVIDER` | `google_safe_browsing_v5` | CTI adapter (`google_safe_browsing_v5`, `google_web_risk`, `mock`) |
| `CYBERSHIELD_CTI_API_KEY` | `""` | Optional CTI API key (if empty, M1 operates strictly in offline heuristic mode) |
| `CYBERSHIELD_ASSISTANT_PROVIDER` | `"none"` | External AI adapter (`none`, `gemini`, `mock`) |
| `CYBERSHIELD_ASSISTANT_API_KEY` | `""` | Optional Gemini API key for conversational assistant |

---

## Offline Voice Models Setup

Due to GitHub repository size limits and bandwidth considerations, binary AI model files (~3.8 GB total) are **excluded from the Git repository via `.gitignore`**.

### Default Behavior Without Models

ABBAY CYBERGUARD starts and runs **100% safely without model binaries**:
- All web modules (M1, M2, M3, M4, M5), the Cyber Hero Journey, Account management, and the Digital City 3D simulation operate without any missing dependencies.
- The Conversational AI Assistant operates in text mode and uses the browser's native speech synthesis for English voice.
- Voice endpoints gracefully report `TTS_MODEL_NOT_INSTALLED` or `MODEL_NOT_FOUND` without server crashes.

### Installing Offline Voice Models (Optional)

If you require full local, offline speech recognition and synthesis for Amharic and Afaan Oromoo:

```
models/voice/
├── bin/
│   └── whisper-cli.exe               # whisper.cpp executable
├── stt/
│   ├── ggml-small-q5_1.bin           # English Whisper STT model (~330 MB)
│   └── amharic/                      # Fine-tuned Whisper Amharic model (Apache-2.0)
│       ├── config.json
│       ├── model.safetensors         # Hugging Face: b1n1yam/whisper-small-am (~960 MB)
│       └── tokenizer.json
└── tts/
    ├── amharic_mms/                  # Meta MMS Amharic TTS model (~140 MB)
    │   ├── config.json
    │   └── model.safetensors
    └── oromo/                        # Meta MMS Afaan Oromoo TTS model (~140 MB)
        ├── config.json
        └── model.safetensors
```

Model paths can be overridden in `.env` using `CYBERSHIELD_WHISPER_MODEL_PATH`, `CYBERSHIELD_AMHARIC_MODEL_DIR`, `CYBERSHIELD_AMHARIC_TTS_MODEL_DIR`, and `CYBERSHIELD_OROMO_TTS_MODEL_DIR`.

---

## Automated Verification & Testing

ABBAY CYBERGUARD enforces strict automated testing across the entire stack. All **1,154 automated tests** pass with 100% success rate:

```
========================= 1,154 passed in total =========================
  • Backend Test Suite:   333 passed  (15 test suites via pytest)
  • Frontend Test Suite:  821 passed  (45 test files via vitest)
=========================================================================
```

### Running Backend Tests

```bash
cd backend
pytest tests/ -v
```
*Validates Argon2id auth, session revocation, consent boundary isolation, M1 heuristic detectors, CTI adapters, voice admission limits, database migrations, and rate limiting.*

### Running Frontend Tests

```bash
cd frontend
npm test
```
*Validates Web Crypto RNG distribution, M1 punycode parsing, M3 draft generation, M4 header analysis, M5 quiz grading, trilingual dictionary key parity across 1,807 keys, 3D WebGL rendering, and responsive mobile controls.*

---

## Production Deployment

### 1. Frontend Static Build

The frontend compiles to optimized static assets:

```bash
cd frontend
npm run build
```
Output directory: `frontend/dist`. Deployable to Cloudflare Pages, Vercel, Netlify, or AWS S3.

For Single-Page Application (SPA) routing, ensure standard fallback routing is configured:
```
/*    /index.html   200
```

### 2. Backend API Service

Deploy the FastAPI backend behind a production WSGI/ASGI server (e.g. Uvicorn or Gunicorn) behind Nginx, Caddy, or a managed cloud platform (Render, Railway, Fly.io):

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 3. Production Hardening Checklist

- [ ] Set `CYBERSHIELD_COOKIE_SECURE=true` in production to enforce HTTPS-only cookies.
- [ ] Set `CYBERSHIELD_ALLOW_NON_LOOPBACK=true` only when running behind a trusted reverse proxy.
- [ ] Ensure `CYBERSHIELD_SECRET_KEY` is set to a cryptographically random 64-character secret.
- [ ] Connect to managed PostgreSQL with SSL mode enabled (`sslmode=require`).
- [ ] Set `CYBERSHIELD_ALLOWED_ORIGINS` to your production domain(s).

---

## Disclosures, Limitations & Ethics

- **Educational Purpose**: ABBAY CYBERGUARD is an educational and security awareness tool. It does not replace enterprise Endpoint Detection and Response (EDR), Security Information and Event Management (SIEM), or certified professional incident handling.
- **Simulated Lab Isolation (M4)**: The Website Security Learning Lab operates strictly against local synthetic fixtures. It does not perform network scanning, port probing, or vulnerability exploitation against live internet assets.
- **Machine Learning Evaluation**: Adaptive recommendations are generated based on local quiz telemetry using synthetic benchmark evaluation distributions. Real-world pedagogical efficacy remains subject to prospective longitudinal evaluation.
- **No Warranty**: ABBAY CYBERGUARD is provided "as is", without warranty of any kind, express or implied.

---

## Contributing & Responsible Disclosure

### Contributing

Contributions, bug reports, and suggestions are welcome:
1. Ensure all new features or bug fixes include corresponding unit and integration tests.
2. Confirm all tests pass: `pytest backend/tests` and `npm test --prefix frontend`.
3. Adhere to existing code conventions (Black/Flake8 for Python; ESLint/Prettier for TypeScript).

### Security Vulnerability Reporting

If you discover a security vulnerability or potential privacy issue in ABBAY CYBERGUARD:
- **Do not open a public issue.**
- Submit details privately to the project maintainers through GitHub Security Advisories or by contacting the repository owner directly.
- We appreciate responsible disclosure and will investigate confirmed reports promptly.

---

## License & Acknowledgments

- **License**: All rights reserved. Evaluation and educational use permitted. (Formal open-source licensing evaluation in progress).
- **Audio Models**: Whisper models by OpenAI; Amharic fine-tuning by `b1n1yam` (Apache-2.0); MMS-TTS models by Meta AI (CC-BY-NC 4.0 / Open Source).
- **Fonts & Typography**: Support for Ethiopic script optimized for Noto Sans Ethiopic and standard Ge'ez typefaces.

---
*ABBAY CYBERGUARD — Protecting digital lives through knowledge, privacy, and community resilience.*
