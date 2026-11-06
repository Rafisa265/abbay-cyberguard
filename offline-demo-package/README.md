# CyberShield Ethiopia — Standalone Offline Competition Package

Welcome to the **CyberShield Ethiopia** competition evaluation package.

This self-contained distribution contains the precompiled, production-ready trilingual Single-Page Application (SPA) and lightweight local FastAPI backend.

---

## 1. Quick Start (1-Minute Setup)

### Option A: Automatic Double-Click Launch (Recommended)
1. Double-click `start-demo.bat`.
2. Open your web browser to: **http://127.0.0.1:8000**
3. When finished, double-click `stop-demo.bat` to shut down.

### Option B: Terminal Command Launch
```cmd
cd backend
python -m venv .venv
call .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python run.py
```
Then visit **http://127.0.0.1:8000** in your browser.

---

## 2. Package Contents & Integrity

- `frontend/dist/`: Precompiled static distribution containing all HTML, CSS, JavaScript, local WOFF2 Ethiopic fonts (`Noto Sans Ethiopic`), and local SVG artwork. **Node.js is NOT required to evaluate this package.**
- `backend/`: FastAPI application code and entrypoint `run.py`.
- `docs/competition-demo-runbook.md`: Comprehensive, timed 5–7 minute evaluator walkthrough script.
- `.env.example`: Non-sensitive configuration template.
- `start-demo.bat` & `stop-demo.bat`: One-click Windows startup and shutdown utilities.

---

## 3. Evaluator Verification Highlights

1. **100% Offline Capable:** Disconnect all internet connections / toggle airplane mode. The application runs entirely from local files.
2. **Trilingual First:** Switch seamlessly between English, Afaan Oromoo, and Amharic via the top-right header selector.
3. **Passive Security Tools:**
   - **M1 Link Checker:** Evaluates links without network requests.
   - **M2 Password Tools:** Cryptographic generation with `crypto.getRandomValues`. Zero storage.
   - **M3 Incident Drafter:** Detects sensitive OTP and credit card leaks locally before copying.
   - **M4 Web Simulation:** Demonstrates HTTP headers via passive test fixtures using `.example` domains.
4. **Cyber Hero Journey:**
   - Play **P01 — Practice 01: The Fictional Campus Job Offer**.
   - Trap answer awards 0 XP. Correct official verification awards 100 XP and unlocks the Adaptive Scout badge.
   - Replaying P01 awards 0 additional XP, preventing score duplication.

---

## 4. Privacy & Safety Commitments

- **No Secrets or User Data:** This package contains zero credentials, real database dumps, user records, or `.env` secrets.
- **Loopback Isolation:** The server binds strictly to `127.0.0.1` and refuses non-loopback requests for security.
- **Guest Mode Default:** All educational tools run without requiring an account or database connection.
