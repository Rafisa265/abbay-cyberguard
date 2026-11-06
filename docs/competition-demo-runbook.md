# CyberShield Ethiopia — Competition Demonstration Runbook & Offline Evaluator Guide

**Document Version:** 1.0.0 (Competition Release)  
**Project Root:** `D:\CyberShield-Ethiopia`  
**Classification:** Official Demonstration Guide  
**Target Audience:** Competition Judges, Evaluators, Technical Reviewers, and Demo Presenters  

---

## 1. Project Purpose & Target Users

### 1.1 Purpose
**CyberShield Ethiopia** is a localized, privacy-first cybersecurity education and threat-literacy platform tailored specifically to the Ethiopian digital landscape. It equips citizens, students, and professionals with practical cognitive defence skills to recognize, analyze, and neutralize localized digital scams before harm occurs.

### 1.2 Target Users
1. **Ethiopian Higher Education Students:** Young adults frequently targeted by fraudulent scholarship notices, fake campus job postings, unverified Telegram channels, and advance-fee recruitment scams.
2. **Mobile Banking & Digital Wallet Consumers:** Users of Telebirr, CBE Birr, and mobile banking applications who face social engineering, SIM swap threats, fake customer support bots, and credential harvesting.
3. **Public & Private Sector Employees:** Individuals handling sensitive communications who need practical phishing awareness and safe incident reporting habits.
4. **Offline & Rural Learners:** Users in connectivity-constrained regions who require self-contained educational tools that do not depend on external internet access or third-party cloud infrastructure.

---

## 2. Architecture & Technologies (Fact-Checked Against Source Code)

The system is built on a clean, decoupled architecture optimized for **zero external network dependencies** in its default operating mode:

```
+-----------------------------------------------------------------------------------+
|                            CYBERSHIELD ETHIOPIA PLATFORM                          |
+-----------------------------------------------------------------------------------+
|  FRONTEND (SPA) - React 18 / Vite / Vanilla CSS Design System                     |
|  - Trilingual Engine: English, Afaan Oromoo, Amharic (1,378 dictionary keys)     |
|  - Typography: 100% Local WOFF2 Fonts (Noto Sans Ethiopic Bold & Regular)        |
|  - Offline Art: 20+ Bundled Local SVG Badges & Mission Artwork                   |
|  - Storage Boundary: LocalStorage limited exclusively to 'lang' & progress       |
|  - Passive Tools: M1 (Link Heuristics & Local CTI), M2 (Password), M3 (Report)   |
|  - Learning Modules: M5 Learn (4 Levels, 22 Quizzes), Journey (M01-M06), 3D Game |
+-----------------------------------------------------------------------------------+
                                         |
                            HTTP / Loopback Only (127.0.0.1)
                                         |
+-----------------------------------------------------------------------------------+
|  BACKEND - Python 3.11+ / FastAPI / Uvicorn (Single Process on Port 8000)         |
|  - Static Server: Mounts precompiled frontend bundle directly at '/'              |
|  - Health & Simulation: /api/v1/health, /api/v1/m4/scenarios, /api/v1/m4/demo      |
|  - Security Middleware: Loopback-only guard, Host/Origin validation, strict CSP,   |
|    X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Cache-Control: no-store |
+-----------------------------------------------------------------------------------+
                                         |
                         Optional Database Session (SQLAlchemy 2)
                                         |
+-----------------------------------------------------------------------------------+
|  DATABASE (Optional Account Mode) - PostgreSQL 16 (Port 5432)                     |
|  - Authentication: Argon2id password hashing (64MB memory cost, 2 time cost)      |
|  - Sessions: SHA-256 token hashes, HttpOnly / SameSite=Lax session cookies        |
|  - Privacy Guard: Progress sync strictly gated by explicit user consent checkbox  |
|  - Guest Mode Support: DB connection is non-blocking; all tools work if DB is off|
+-----------------------------------------------------------------------------------+
```

### 2.1 Technology Stack
- **Frontend:** React 18, Vite 8, Vanilla CSS Design System with WCAG 2.5.5 touch compliance ($\ge 44\text{px}$ targets).
- **Backend:** FastAPI 0.115+, Uvicorn, Pydantic v2, Starlette.
- **Database & ORM:** PostgreSQL 16, SQLAlchemy 2.0, Psycopg 3 (native async-capable driver), Alembic migrations.
- **Cryptographic Primitives:** Web Cryptography API (`crypto.getRandomValues`), Argon2id (`argon2-cffi`), SHA-256.

### 2.2 Dual-Mode Architecture & Privacy Guarantees
- **Guest Mode (Default & Zero Setup):** All educational tools, simulations, and Cyber Hero Journey scenarios function completely within browser memory and local storage. No user accounts, passwords, or server round-trips are required.
- **Account Mode (Optional):** Provides cross-device synchronization for learning achievements. Synchronized data is strictly limited to high-level numeric level IDs and star ratings. **Passwords, checked links, and incident report narratives are NEVER saved to the database or logged on the server.**

---

## 3. Implemented Features vs. Planned Scope (Honesty & Transparency)

To maintain absolute competition integrity, the platform strictly declares the boundaries of its current implementation:

| Functional Area | Current Verified Implementation | Explicitly Prohibited / Planned Scope |
| :--- | :--- | :--- |
| **M1 Link Checker & CTI** | **Passive client heuristics & offline local threat feed:** IP address detection, punycode spoofing, suspicious keyword matching, URL shortener flags, length validation, and offline Protobuf/JSON local feed lookup (`LocalFeedCTIAdapter`). Includes strict educational disclaimers. | **NO live web crawling, NO unauthorized active scanning.** External threat lookups require explicit API key and opt-in consent. Never claims a URL is "guaranteed safe". |
| **M2 Password Tools** | **Local entropy calculation and unbiased generation:** Rejection sampling with Fisher-Yates shuffle via `crypto.getRandomValues`. Immediate clearing and zero client storage. | **NO password storage, NO transmission of submitted passwords.** |
| **M3 Incident Drafter** | **Structured client-side template generator:** Field validation, sensitive card/OTP leak warning flags, copy-to-clipboard, text download. Strict channel verification filter. | **Does NOT send incident reports across the network.** Does NOT invent unverified regulatory phone numbers or channels. |
| **M4 Web Security Demo** | **Predefined simulated fixtures:** Enumerated scenarios using RFC 2606 `.example` hostnames (`demo-a.example`, etc.) showcasing missing headers and security configurations. | **NO unauthorized live scanning of real targets.** `/api/v1/m4/live` returns HTTP 404 by security design. |
| **M5 Learn & Quiz** | **4 difficulty tiers across 5 Ethiopian cyber threat topics:** 22 interactive questions with immediate explanations, scoring, and star ratings. | Does not claim to replace professional certifications. |
| **Cyber Hero Journey** | **6 core reviewed campaign missions (M01–M06) + deterministic practice generator:** Covers local Ethiopian vectors (scholarships, SIM swap, mobile banking bots, job APKs, advance-fee scams, urgent wire requests), XP tracking, rank progression, badge awards, replay anti-duplication rules (awards XP once; 0 XP on replay). | Offline deterministic generator operates without cloud AI/ML models. |
| **3D CyberBattle Game** | **Interactive 3D WebGL cyber defense arena:** Service restoration mechanics, collision boundaries, responsive HUD controls, attacker/defender game modes. | Operates entirely client-side without external game engine downloads. |
| **Localization** | **100% Trilingual Parity across 1,378 keys:** English, Afaan Oromoo, and Amharic with zero empty entries and localized Ethiopic typography. | Translations are human-reviewed drafts tailored for civic education. |

---

## 4. Prerequisites & Exact Startup Commands

The application is engineered to run on any standard Windows machine.

### 4.1 System Prerequisites
- **Operating System:** Windows 10 or 11 (64-bit).
- **Python:** Python 3.11+ installed and accessible via `python` or virtual environment `.venv`.
- **Node.js (Optional / Build Only):** Node.js 20+ (only required if recompiling the frontend; the production bundle is already prebuilt in `frontend/dist/`).
- **PostgreSQL (Optional for Guest Demo):** Local cluster on port `5432`. If stopped, the platform runs in full Guest Mode.

### 4.2 Starting PostgreSQL (Optional — for Account Mode)
If PostgreSQL is running as a local portable binary or service:
```powershell
# Verify PostgreSQL is listening on 127.0.0.1:5432
Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
```
*(If PostgreSQL is stopped, you may still run the entire demo in Guest Mode without issues.)*

### 4.3 Starting the Application (Single Command)
Open a terminal in `D:\CyberShield-Ethiopia` and run:
```cmd
start.bat
```
Alternatively, run directly with PowerShell:
```powershell
Set-Location -Path "D:\CyberShield-Ethiopia\backend"
& ".\.venv\Scripts\python.exe" run.py
```

### 4.4 Verifying the Services Are Running
1. **Frontend UI:** Open your browser to `http://127.0.0.1:8000/`. You should see the CyberShield Ethiopia homepage with the shield logo and trilingual navigation.
2. **API Health Endpoint:**
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health"
   # Output: {"status":"ok"}
   ```
3. **Security Headers Verification:**
   ```powershell
   $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/" -Method Head
   $resp.Headers["Content-Security-Policy"]
   # Shows: default-src 'self'; script-src 'self'; ...
   ```

---

## 5. Timed Competition Demonstration Script (5–7 Minutes)

Follow this structured, time-budgeted demonstration sequence during evaluation:

```
[0:00 - 0:45] Homepage & Trilingual Architecture
     │
[0:45 - 1:45] M1 Link Checker (Passive Heuristics & Limitations)
     │
[1:45 - 2:30] M2 Password Tools (Entropy & Unbiased Generator)
     │
[2:30 - 3:15] M3 Incident Drafter (Validation & Credential Guard)
     │
[3:15 - 4:00] M4 Simulated Web Security Demo (Safe Fixtures)
     │
[4:00 - 4:45] M5 Learn & Quiz (Curriculum & Knowledge Check)
     │
[4:45 - 6:00] Cyber Hero Journey (P01 Campus Scam, Traps & XP)
     │
[6:00 - 6:30] Privacy & Data Boundary Verification
     │
[6:30 - 7:00] Summary & Judges Q&A
```

---

### Step 1: Homepage & Trilingual Architecture (0:00 – 0:45)
- **Goal:** Introduce the mission, Ethiopian focus, and seamless trilingual capability.
- **Presenter Actions:**
  1. Navigate to `http://127.0.0.1:8000/`.
  2. Point out the title: *"CyberShield Ethiopia — Community Cyber Awareness & Threat Literacy"*.
  3. Show the **Language Selector** in the upper-right corner.
  4. Switch from **English** $\rightarrow$ **Afaan Oromoo** $\rightarrow$ **አማርኛ** (Amharic).
  5. Show how the entire UI, value proposition pillars, and navigation seamlessly update without refreshing the page. Note the local Ethiopic fonts (`Noto Sans Ethiopic`).
  6. Point out the four value pillars: *100% Offline Capable*, *Ethiopian Threat Focus*, *Practical Tools*, and *Trilingual First*.
- **Presenter Spoken Script:**
  > *"Welcome to CyberShield Ethiopia. Digital adoption in Ethiopia is accelerating rapidly through Telebirr, mobile banking, and university campus networks, but cyber awareness resources are rarely available in local Ethiopian languages. CyberShield solves this with an offline-first, trilingual platform designed for university students and everyday mobile citizens, fully localized in English, Afaan Oromoo, and Amharic."*

---

### Step 2: M1 Link Checker (0:45 – 1:45)
- **Goal:** Demonstrate passive URL heuristic analysis and strict adherence to safety disclaimers.
- **Presenter Actions:**
  1. Click the **M1 Link Checker** tab (`#/m1`).
  2. Note the prominent disclaimer: *"This is an educational heuristic checker. Indicators can appear on legitimate links, and dangerous links can show none. Never claim a link is guaranteed safe."*
  3. Enter a safe, fictional suspicious URL in the input field:
     ```text
     http://192.168.1.1/telebirr-login-update
     ```
  4. Click **Inspect Link**.
  5. Point out the heuristic indicators detected:
     - Direct IP address instead of domain name (`IND-01`).
     - Insecure HTTP protocol (`IND-05`).
     - High-risk target keyword (`login`, `update`) in URL path (`IND-07`).
     - Risk level: **High Caution**.
  6. Clear the field and type: `https://example.com/research`. Show that the tool calculates a low risk level but **never** says "The link is guaranteed safe".
- **Presenter Spoken Script:**
  > *"Module 1 is our educational link inspector. Unlike dangerous tools that fetch external websites, M1 analyzes the URL purely passively on the client. It highlights classic phishing indicators—such as raw IP addresses, unencrypted HTTP, and brand-impersonation keywords. Most importantly, it never gives a false sense of security: our policy strictly prohibits claiming that any link is 100% guaranteed safe."*

---

### Step 3: M2 Password Tools & Privacy Zero-Storage (1:45 – 2:30)
- **Goal:** Demonstrate password entropy evaluation, unbiased cryptographic generation, and zero-storage privacy.
- **Presenter Actions:**
  1. Click the **M2 Password** tab (`#/m2`).
  2. Point out the privacy note: *"Passwords entered or generated here stay entirely inside your browser memory. They are never transmitted or stored."*
  3. In the evaluator field, type a common weak password:
     ```text
     password123
     ```
  4. Point out the instant feedback: Category **Very Weak**, flags for dictionary word, number sequence, and length.
  5. Click **Generate New Password** under the Generator card.
  6. Adjust the length slider to `20` characters. Show that lowercase, uppercase, digits, and symbols are included.
  7. Click **Copy Password** and show the confirmation. Click **Clear**.
- **Presenter Spoken Script:**
  > *"Module 2 provides local password evaluation and generation. We reject Math.random in favor of Web Cryptography's getRandomValues with Fisher-Yates shuffling for unbiased distribution. Under our zero-storage privacy rule, passwords never touch localStorage, sessionStorage, or network requests."*

---

### Step 4: M3 Incident Report Drafter (2:30 – 3:15)
- **Goal:** Demonstrate structured incident documentation, sensitive credential leak detection, and verified channel policy.
- **Presenter Actions:**
  1. Click the **M3 Report** tab (`#/m3`).
  2. Select Incident Type: **Phishing / Impersonation**. Date: Today's date.
  3. In the narrative field, type:
     ```text
     Received a Telegram message from an unverified recruiter asking for an advance processing fee. Scammer asked for OTP: 482913 and card: 4111 1111 1111 1111.
     ```
  4. Click **Create Draft**.
  5. Show the resulting draft in the preview box.
  6. **Key Demonstration:** Point out the warning banner:
     - 🚩 Sensitive secret detected: `secret` (flagged OTP keyword).
     - 🚩 Payment card number detected: `card` (Luhn algorithm confirmed valid test card pattern).
  7. Show the **Reporting Channels** section: Explain that CyberShield Ethiopia strictly forbids inventing fake regulatory phone numbers; only formally verified regulatory channels are displayed.
- **Presenter Spoken Script:**
  > *"When an Ethiopian citizen experiences fraud, panic often causes them to accidentally include passwords or credit card numbers in complaint emails. Module 3 drafts an incident dossier while scanning the text for sensitive credentials using pattern and Luhn checks. It prompts the user to redact secrets before copying or saving."*

---

### Step 5: M4 Simulated Web Security Demo (3:15 – 4:00)
- **Goal:** Prove that web security demonstration is safe, passive, and strictly simulated.
- **Presenter Actions:**
  1. Click the **M4 Simulation** tab (`#/m4`).
  2. Point out the banner: *"M4 SIMULATED DEMO — Passive simulation only"*.
  3. Select scenario **DS-A (`demo-a.example`)**.
  4. View the simulated header checks: `Content-Security-Policy` (Missing), `Strict-Transport-Security` (Missing), `Server Info Disclosure` (Present).
  5. Explain that all demo hostnames use RFC 2606 reserved `.example` domains.
  6. Mention that live vulnerability scanning is explicitly disabled and returns HTTP 404.
- **Presenter Spoken Script:**
  > *"Module 4 demonstrates HTTP defensive headers using pre-packaged, simulated test fixtures. We deliberately forbid live network scanning or active exploitation. This guarantees that CyberShield Ethiopia can be safely used in classrooms, public networks, and competition environments without legal or security risk."*

---

### Step 6: M5 Learn & Quiz (4:00 – 4:45)
- **Goal:** Showcase the structured curriculum and interactive quizzes.
- **Presenter Actions:**
  1. Click the **Learn** tab (`#/learn`).
  2. Show the 5 topic tracks: *Phishing & Fake Offers*, *Password & Credential Safety*, *Social Engineering & Impersonation*, *Device & Network Security*, and *Safe Reporting & Incident Response*.
  3. Click **Level 1 Quiz**. Answer a question correctly to show the immediate positive feedback and educational rationale.
  4. Intentionally select an incorrect option to show how the platform guides the learner with clear explanations rather than simple penalties.
- **Presenter Spoken Script:**
  > *"Our Learn module delivers bite-sized, curriculum-aligned cybersecurity literacy across four progressive levels. Learners receive instant feedback and contextual explanations designed to build long-term critical thinking."*

---

### Step 7: Cyber Hero Journey & Practice Scenarios (4:45 – 5:30)
- **Goal:** Demonstrate the flagship interactive simulation, focusing on the 6 reviewed Ethiopian threat missions (M01–M06) and the anti-duplication XP rules.
- **Presenter Actions:**
  1. Click the **Cyber Hero** tab (`#/journey`).
  2. Show the core reviewed campaign progression:
     - **M01**: Fake University Scholarship Portal
     - **M02**: Telecom SIM Upgrade OTP Phishing
     - **M03**: Fake Banking Support Bot PIN Theft
     - **M04**: Malicious Job APK Android Sideloading
     - **M05**: Romance / Advance-Fee Investment Scam
     - **M06**: Impersonation & Urgent Wire Request
  3. Show the **Practice Missions** section and click **P01 — Practice 01: The Fictional Campus Job Offer**.
  4. Review the simulated scenario: Abel received an unsolicited message from `@Ethio_Jobs_Assistant_Demo` promising an immediate campus job for a 350 ETB "processing fee".
  5. Inspect the three simulated evidence items: *Unverified Recruiter Handle*, *Upfront Fee Requirement*, and *Artificial Urgency*.
  6. **Demonstrate Trap Answer:** Click the trap choice: *💳 Pay the 350 ETB fee immediately*. Click **Confirm Decision**.
     - Show the defeat feedback: The recruiter disappears with the money; **0 XP awarded**, mission **not** completed.
  7. Click **Replay**. Select the correct action: *🛡️ Contact the University Student Career Bureau through official campus channels*.
     - Show the victory modal: **+100 XP awarded**, badge unlocked: `Adaptive Scout`, rank upgraded to **Defender**.
  8. **Demonstrate Replay Anti-Duplication Rule:** Click **Replay Mission** and choose the correct answer a second time.
     - Show that the outcome clearly states the mission was already completed: **0 additional XP awarded**, total XP remains stable at 100 XP, and progress is never erased.
- **Presenter Spoken Script:**
  > *"Cyber Hero Journey is our gamified scenario simulator. In Practice Scenario 01, students encounter a realistic Ethiopian campus recruitment scam. Trap answers produce immediate explanations and award 0 XP. When the user verifies through official channels, they earn 100 XP and the Adaptive Scout badge. Our strict replay engine ensures that replaying completed missions awards 0 additional XP, preventing score duplication while reinforcing learning."*

---

### Step 7.5: 3D CyberBattle Game & Arena (5:30 – 6:00)
- **Goal:** Showcase the 3D WebGL terminal and interactive cyber defense arena.
- **Presenter Actions:**
  1. Navigate to **Arena / CyberBattle** (`#/game` or `#/battle`).
  2. Point out the interactive 3D canvas and HUD.
  3. Walk toward the directory server and highlight the service restoration interaction.
  4. Note that the entire 3D engine runs client-side with zero external assets or cloud servers required.
- **Presenter Spoken Script:**
  > *"To engage younger audiences and university labs, CyberShield features an interactive 3D CyberBattle arena. Evaluators can explore the virtual server room and restore breached services in real time, all running smoothly in WebGL without any external engine downloads."*

---

### Step 8: Privacy & Data Boundary Verification (6:00 – 6:30)
- **Goal:** Prove privacy adherence to the evaluators.
- **Presenter Actions:**
  1. Open the browser Developer Tools (`F12`) $\rightarrow$ **Application** $\rightarrow$ **Local Storage**.
  2. Show that only two non-sensitive keys exist:
     - `lang`: Stores the 2-letter language code (`"en"`, `"om"`, or `"am"`).
     - `cybershield_journey_progress`: Contains level completion booleans, total XP (100), and badge list.
  3. Show that **no passwords, credit card numbers, or report text** are stored anywhere in browser storage.
  4. Click the **Account** tab: Show that the app is running in **Guest Mode (Default)**, with no account required.
- **Presenter Spoken Script:**
  > *"Finally, we invite evaluators to inspect our storage boundaries. As seen in the console, our local storage is strictly bounded to the user's language code and non-sensitive journey stats. CyberShield Ethiopia proves that high-impact cybersecurity education can be achieved with zero data harvesting."*

---

## 6. How to Demonstrate Offline Capabilities Accurately

To demonstrate offline resilience honestly and transparently:
1. **Physical Disconnect / Airplane Mode:**
   - Disconnect your machine from Wi-Fi or unplug the Ethernet cable.
   - Refresh the page at `http://127.0.0.1:8000/`.
   - Show that the entire application loads instantly.
2. **Offline Font & Asset Verification:**
   - In Developer Tools $\rightarrow$ **Network** tab, check the "Offline" box.
   - Navigate across all tabs.
   - Notice that fonts (`NotoSansEthiopic`), SVG illustrations, heuristics, password generator, report drafter, and journey scenarios work seamlessly.
3. **What Requires Local Loopback:**
   - Emphasize to judges that while no external internet connection is required, the local FastAPI process running on `127.0.0.1:8000` serves the application files and simulated headers.

---

## 7. Safe Application Shutdown

To cleanly terminate the demonstration environment:
1. **Stop FastAPI Backend:**
   - Switch to the terminal window where `start.bat` or `python run.py` is running.
   - Press `Ctrl + C`.
   - Wait 2 seconds for Uvicorn to complete graceful shutdown:
     ```text
     INFO:     Shutting down
     INFO:     Finished server process
     ```
2. **Stop PostgreSQL (If running in background):**
   ```powershell
   # If using portable scratch binary
   & "C:\path\to\pgsql\bin\pg_ctl.exe" -D "C:\path\to\pgdata" stop
   ```
3. Close the browser window. All database records and backups remain untouched.

---

## 8. Troubleshooting Guide for Competition Evaluators

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Port 8000 already in use** | A previous instance of Uvicorn or another local dev server is still running. | Run `netstat -ano \| findstr :8000` to find the PID, then terminate it with `taskkill /F /PID <PID>`, or restart via `start.bat`. |
| **Frontend displays 404 or blank white page** | The frontend production build in `frontend/dist/` is missing or incomplete. | Run `cd frontend; npm.cmd run build` to recompile the static distribution (takes < 1 second). |
| **"HOST_NOT_ALLOWED" error on API** | Browser request used a non-loopback hostname (e.g. LAN IP address). | Access the application exclusively via `http://127.0.0.1:8000/` or `http://localhost:8000/`. Loopback isolation is enforced for security. |
| **Database error on `/account` registration** | PostgreSQL is stopped or credentials differ. | The platform is 100% usable in **Guest Mode**. Simply click any tool or Cyber Hero Journey without logging in. To enable accounts, start PostgreSQL on port 5432. |
| **Amharic font appears as squares/question marks** | System lacks Ethiopic font support. | CyberShield bundles local `NotoSansEthiopic.woff2` files in `dist/fonts/`. Ensure web fonts are not blocked by strict browser extensions. |
