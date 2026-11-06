# CyberShield Ethiopia — Competition Demo Readiness Checklist

**Document Purpose:** Pre-Flight, Live Execution & Post-Demo Verification Checklist  
**Project Location:** `D:\CyberShield-Ethiopia`  
**Host Environment:** Windows (x64), Python 3.15, Node 24, Vite 8  
**Local URL:** `http://127.0.0.1:8000` (FastAPI + Static Bundle) or `http://localhost:5173` (Vite Dev)  
**Target Operating Mode:** 100% Offline-First / Guest Mode  

---

## 1. Pre-Flight Verification (30 Minutes Before Presentation)

Execute these verification checks before taking the stage:

- [ ] **1.1 Project Root & Archive Integrity**
  - Verify working directory is exactly `D:\CyberShield-Ethiopia`.
  - Confirm `D:\CyberShield-Ethiopia.zip` is present and unchanged (Size: ~59,415 bytes, 49 entries).
  - *Do not delete, overwrite, or rename the backup archive.*

- [ ] **1.2 Clean Port Check**
  - Verify that neither port 8000 nor port 5173 is occupied by dangling processes:
    ```powershell
    Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue
    ```
  - If a dangling process is found, terminate that specific PID before starting.

- [ ] **1.3 Start Services**
  - **Option A (Recommended Single-Process Production Daemon):**
    ```powershell
    # Terminal 1 — From repository root:
    .\backend\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000
    ```
    *Note: Serves both backend API and pre-compiled production frontend bundle at `http://127.0.0.1:8000`.*
  - **Option B (Two-Terminal Developer Mode):**
    - Terminal 1: `.\backend\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000`
    - Terminal 2: `cd frontend; npm.cmd run dev` (Access at `http://localhost:5173`).

- [ ] **1.4 Quick Liveness Smoke Probe**
  - Verify backend health endpoint returns HTTP 200:
    ```powershell
    Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health"
    # Expected Output: @{status=ok}
    ```
  - Verify Assistant status endpoint returns operational:
    ```powershell
    Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/assistant/status"
    # Expected Output: @{status=operational; offline_knowledge_entries=11; ...}
    ```

---

## 2. Live Demonstration Flow & Safe Input Matrix

Use **strictly synthetic and safe test inputs**. Never use real passwords, personal phone numbers, or live malicious links during the presentation:

| Segment | Screen / Route | Required Presenter Action | Verified Safe Synthetic Input | Expected Live UI Result |
| :--- | :--- | :--- | :--- | :--- |
| **Intro** | Homepage (`#/`) | Show hero section and offline status pill. | None (Initial render) | `100% In-Browser & Offline` badge visible. |
| **Assistant** | Homepage (`#/`) | Click quick prompt chip. | Click: `💬 What if I already clicked a suspicious link?` | Navigates to `#/assistant?q=...`, shows prioritized triage (hotlines 951, 994). |
| **M1 Clean** | Link Checker (`#/m1`) | Input clean university URL. | `https://portal.aau.edu.et/` | Low risk score, structural breakdown, clean disclaimer. |
| **M1 Phish** | Link Checker (`#/m1`) | Input synthetic phishing trap. | `http://telebirr-bonus-claim.top/login.php?account=verify` | Red flag alerts, ML factor card shows $>99\%$ phishing probability. |
| **M2 Pass** | Password Vault (`#/m2`) | Type weak password, then click Generate. | `telebirr2026` | Live entropy bar flags low entropy. CSPRNG generates high-entropy passphrase. |
| **M3 Report**| Incident Report (`#/m3`)| Input fictional OTP scam narrative. | `"Someone called claiming to be Ethio Telecom and asked for my SMS OTP to upgrade my SIM card"` | Model suggests category **SIM Swap / OTP Theft**. Card warning on 16 digits. Hotlines 933, 994, 951, 991. |
| **M4 Sim** | Website Checker (`#/m4`)| Select scenario from dropdown. | Choose: `DS-A: Bank Portal` | Simulated findings for CSP/HSTS headers. Live probing confirmed disabled. |
| **Journey** | Hero Journey (`#/journey`)| Open Mission 01, choose defensive action. | Mission 01: Verify announcement on official portal. | Immediate pedagogical feedback, +100 XP increment, rank preserved in `localStorage`. |
| **Language**| Navbar Top Right | Switch between EN, OM, AM. | Click **Afaan Oromoo**, then click **አማርኛ**. | Headers, buttons, and mission dialogues update with zero raw key fallbacks. |

---

## 3. Strict Safety & Demonstration Invariants

- [ ] **No Real Credentials:** Never type personal passwords, real payment cards, or sensitive personal phone numbers into M2 or M3.
- [ ] **No Live Malicious Probing:** Never enter active, unverified, or public malware URLs into M1. Use only the synthetic test fixtures specified in the matrix above.
- [ ] **Offline Integrity Check:** Verify that external AI remains disabled by default. If judges ask about cloud LLMs (Gemini/Groq), explain that they are deliberately gated behind an explicit consent checkbox and user-supplied API keys to protect citizen privacy.
- [ ] **No User Progress Reset:** Do not click "Reset Journey Progress" during the live demonstration unless you intend to demonstrate the initial recruit state.
- [ ] **No Database Invocations:** The application runs reliably in Guest Mode. Do not attempt to run database migrations, start PostgreSQL, or alter database configurations during the demonstration.

---

## 4. Troubleshooting & Fallback Contingency Plans

| Scenario / Issue | Root Cause | Immediate Presenter Action | Explanation to Judges |
| :--- | :--- | :--- | :--- |
| **CTI badge shows `Online Check Unavailable`** | Safe default: `CYBERSHIELD_CTI_API_KEY` is unconfigured. | Do not panic; point directly to the badge. | *"This is an intentional design feature: our platform operates without third-party cloud trackers to protect citizen privacy."* |
| **Accidental browser page refresh** | Presenter hits F5 or reload. | Allow page to reload. | *"Notice how the application instantly restores your active mission progress and selected language from local storage."* |
| **Judges ask why login/register fails** | PostgreSQL port 5432 is intentionally inactive on demo machine. | Show Guest Mode banner. | *"The educational platform is self-contained in Guest Mode. Server-backed accounts are an optional enterprise deployment tier."* |
| **Assistant response takes 2–3 seconds on first query** | Python virtualenv cold-start. | Wait smoothly; subsequent queries are instantaneous. | *"The offline knowledge engine is evaluating the token distribution locally."* |

---

## 5. Post-Demo Clean-Down Checklist

After completing the presentation and judge Q&A:

- [ ] **5.1 Close Browser Windows**
  - Close demonstration browser tabs.
- [ ] **5.2 Stop Server Processes Gracefully**
  - Press `Ctrl + C` in the Uvicorn terminal window to stop the backend daemon.
- [ ] **5.3 Verify Workspace Integrity**
  - Confirm `D:\CyberShield-Ethiopia.zip` remains intact and unmodified.
  - Confirm no production code files were altered or deleted.
- [ ] **5.4 Record Presentation Outcome**
  - Document judge questions, feedback, and requested follow-ups for post-competition review.

---
*End of Demo Readiness Checklist.*

