# CyberShield Ethiopia — Competition Demonstration Script (8–10 Minutes)

**Product Name:** CyberShield Ethiopia  
**Target Event:** Software Engineering & Innovation Competition  
**Presenter:** Project Lead / Lead Software Engineer  
**Target Environment:** Localhost / Loopback (`http://127.0.0.1:8000` or `http://localhost:5173`)  
**Operating Mode:** 100% Offline-First / Guest Mode (Zero Cloud Dependencies)  
**Total Allocated Duration:** 8 to 10 Minutes  

---

## Presentation Timing & Segment Overview

| Part | Section Title | Target Timing | Elapsed Time | Primary Visual & Feature Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Part A** | Problem Statement & Architecture Introduction | 1.0 min | 0:00 – 1:00 | Hero Banner, Privacy Invariants, System Overview |
| **Part B** | Homepage & Shared Conversational Assistant | 1.0 min | 1:00 – 2:00 | AI Assistant Card, Prompt Chips, Offline Knowledge Engine |
| **Part C** | Module M1: Link & URL Risk Analysis | 1.5 min | 2:00 – 3:30 | Heuristic Rules, Lexical ML Factor Card, CTI Status |
| **Part D** | Module M2: Password Safety & Cryptography | 1.0 min | 3:30 – 4:30 | Shannon Entropy, Client-Side CSPRNG, Zero-Transmission |
| **Part E** | Module M3: Incident Reporting & Triage | 1.0 min | 4:30 – 5:30 | In-Browser Text ML, Credential Scrubbing, National Hotlines |
| **Part F** | Module M4: Website Security Simulation | 1.0 min | 5:30 – 6:30 | Simulated Fixtures (`DS-A`/`DS-B`), Header Education, Anti-Reconnaissance |
| **Part G** | Cyber Hero Journey & Adaptive Learning | 1.5 min | 6:30 – 8:00 | Mission Interaction, XP Persistence, ML Copilot Toggle |
| **Part H** | Trilingual Parity, Privacy Summary & Q&A Transition | 1.0 min | 8:00 – 9:00 | Instant EN / OM / AM Toggle, Bundled WOFF2 Typography, Conclusion |

---

## Detailed Step-by-Step Script

---

### Part A — Introduction: Local Context & System Purpose
**Estimated Time:** 1.0 Minute (0:00 – 1:00)  
**Presenter Action:** Display the browser open to `http://127.0.0.1:8000` or `http://localhost:5173`. Ensure the homepage is visible with the navigation bar and hero section.

#### Spoken Words:
> *"Respected judges and faculty members, good morning. My name is [Your Name], and I am proud to present **CyberShield Ethiopia**.*
>
> *Across Ethiopia, millions of citizens, university students, and small enterprises are adopting digital financial services at unprecedented speed through platforms like Telebirr, CBE Birr, and mobile banking. However, rapid digital adoption has created a severe vulnerability gap: everyday users are confronted daily with deceptive SMS messages, fraudulent scholarship portals, SIM swap schemes, and social engineering traps.*
>
> *Most existing cybersecurity awareness tools suffer from three fatal flaws in our context: they require constant high-speed internet, they communicate exclusively in English, and they frequently exfiltrate user data to foreign cloud servers.*
>
> ***CyberShield Ethiopia** solves this directly. It is a localized, privacy-first, offline-capable digital defense platform built specifically for Ethiopian citizens. It operates completely in the browser without requiring external internet access, provides full native support across English, Afaan Oromoo, and Amharic, and never exfiltrates private credentials. Let me show you how it works in practice."*

**Visual Focal Point:** Point to the top navigation, the offline security badge (`100% In-Browser & Offline`), and the hero headline.

---

### Part B — Homepage & Shared Conversational Assistant
**Estimated Time:** 1.0 Minute (1:00 – 2:00)  
**Presenter Action:** Scroll down to the **CyberShield AI Assistant** card on the homepage. Click on the pre-configured prompt chip:  
`💬 What if I already clicked a suspicious link?`

#### Spoken Words:
> *"At the center of our user experience is the shared CyberShield Conversational Assistant. Unlike conventional chatbots that send your private queries to commercial cloud APIs, our Assistant operates **offline-first** by default, powered by an indexed, deterministic knowledge base.*
>
> *When a concerned citizen taps this common question—'What if I already clicked a suspicious link?'—the system instantly navigates into the Assistant interface and delivers prioritized, localized incident triage steps.*
>
> *Notice what it emphasizes: disconnect from the network, change compromised passwords from a safe device, verify whether an APK file was downloaded, and contact verified emergency hotlines—including 951 for CBE and 994 for Ethio Telecom. Most importantly, it clearly states that clicking a link alone rarely proves device compromise, preventing panic while promoting decisive action.*
>
> *Notice the engine badge in the corner: it reads `🛡️ Offline-First Engine`. If an offline answer is ever insufficient, external AI is strictly gated behind an explicit, informed consent checkbox. Zero external calls are made by default."*

**Visual Focal Point:** Show the assistant response, the prioritized triage list, and the `Offline-First Engine` status pill. Point out the return button and follow-up suggestion chips.

---

### Part C — Module M1: Link & URL Risk Analysis
**Estimated Time:** 1.5 Minutes (2:00 – 3:30)  
**Presenter Action:** Click the navigation link **M1 Link** (`#/m1`).

#### Spoken Words:
> *"Let us navigate to Module M1: Suspicious Link & Threat Checker. M1 provides dual-layer risk analysis: deterministic structural heuristics combined with a trained offline machine learning classifier.*
>
> *First, let us test a clean synthetic example. I will enter `https://portal.aau.edu.et/` and click 'Inspect Threat'.*
>
> *(Wait 1 second for instant analysis)*
>
> *The engine evaluates 10 structural URL indicators and reports a low risk score. Notice our educational disclaimer prominently displayed below: a clean score indicates absence of suspicious indicators, but no automated tool can guarantee absolute safety.*
>
> *Now, let us test a realistic synthetic phishing attack commonly seen in Ethiopia:  
> `http://telebirr-bonus-claim.top/login.php?account=verify`*
>
> *(Click 'Inspect Threat')*
>
> *Instantly, M1 flags critical red flags: an insecure HTTP connection, an untrusted `.top` top-level domain, and brand impersonation targeting Telebirr.*
>
> *Look below at the **ML Factor Summary Card**. Here we see our genuine offline Machine Learning model—`ml_url_lexical_v1`. It extracted 12 structural features—such as path length, digit ratio, and domain Shannon entropy—and classified this URL as phishing with over 99% probability.*
>
> *Notice the Cyber Threat Intelligence (CTI) badge: it displays `Online Check Unavailable`. This is an intentional demonstration of our fail-safe architecture: because this machine is operating offline without external Google Safe Browsing API keys, the system gracefully withholds online lookups and protects the user using pure local heuristics and ML. Crucially, M1 **never visits or crawls** the candidate link, protecting the user from drive-by downloads."*

**Visual Focal Point:** Highlight the 10-indicator heuristic breakdown, the `ML Factor Summary` card with probability score, and the CTI unavailable status pill.

---

### Part D — Module M2: Password Safety & Cryptographic Tools
**Estimated Time:** 1.0 Minute (3:30 – 4:30)  
**Presenter Action:** Click the navigation link **M2 Password** (`#/m2`).

#### Spoken Words:
> *"In Module M2, we address password security. Many commercial password checkers upload passwords to remote servers for breach checking, introducing severe credential leakage risks. CyberShield Ethiopia enforces a **zero-transmission boundary**: all computations execute exclusively inside the client browser's memory.*
>
> *Let us type a common weak password: `telebirr2026`.*
>
> *(Type into the input box)*
>
> *The evaluator instantly calculates exact mathematical **Shannon entropy** in bits. It detects Ethiopian dictionary patterns, flags the predictability of sequential numbers, and explains why length is superior to complex substitutions.*
>
> *Next, let us generate a secure passphrase. I will click 'Generate Secure Password'.*
>
> *(Click the generate button)*
>
> *This generator utilizes the browser's native cryptographic pseudo-random number generator (`window.crypto.getRandomValues`) with uniform rejection sampling. When we hash passwords in our educational vault, we utilize PBKDF2 with SHA-256 and 100,000 iterations inside `window.crypto.subtle`.*
>
> *Judges, you can inspect the browser's developer tools Network tab right now: **zero network packets** were transmitted. The password was born in browser memory, evaluated in browser memory, and never left this machine."*

**Visual Focal Point:** Show the real-time entropy calculation bar, the Ethiopian wordlist penalty, and the generated password card.

---

### Part E — Module M3: Incident Reporting & Triage
**Estimated Time:** 1.0 Minute (4:30 – 5:30)  
**Presenter Action:** Click the navigation link **M3 Report** (`#/m3`).

#### Spoken Words:
> *"When a citizen falls victim to fraud, they are often in distress and do not know how to document evidence or whom to call. Module M3 acts as a guided Incident Report Assistant.*
>
> *Let us input a fictional incident description into the 'What Happened?' field:  
> `'Someone called claiming to be Ethio Telecom customer service and asked for my SMS OTP to upgrade my SIM card.'`*
>
> *(Observe the dynamic recommendation banner appear)*
>
> *Notice what just occurred: our client-side machine learning text classifier—`ml_m3_incident_v1`—analyzed the narrative text in browser memory. It detected localized threat indicators and recommended the category **SIM Swap / OTP Theft** with high confidence. I can click 'Apply Category' to update the report in one tap.*
>
> *Now, let us test our privacy safeguard. If an upset user accidentally pastes sensitive credentials—such as a 16-digit payment card number—our real-time Luhn algorithm detects it immediately and displays a prominent warning reminding the user to redact financial credentials before saving.*
>
> *Below, M3 provides verified national hotlines: **933** for INSA, **994** for Ethio Telecom, **951** for the Commercial Bank of Ethiopia, and **991** for the Federal Police. The user can export a standardized, redaction-safe PDF dossier directly from their browser to present to law enforcement.*
>
> *We explicitly tell the user: this is an educational documentation assistant, not an automated police filing."*

**Visual Focal Point:** Show the ML category suggestion banner, the hotline numbers card, and the PDF export button.

---

### Part F — Module M4: Website Security Simulation
**Estimated Time:** 1.0 Minute (5:30 – 6:30)  
**Presenter Action:** Click the navigation link **M4 Simulation** (`#/m4`).

#### Spoken Words:
> *"Module M4 is our Website Security Simulation. In educational environments, teaching web security is critical, but allowing students to probe live external websites creates severe legal liabilities, denial-of-service risks, and potential SSRF vulnerabilities.*
>
> *CyberShield Ethiopia solves this through **sandboxed educational simulation**. M4 provides curated fixtures representing typical organizational architectures—such as `DS-A: Bank Portal`, `DS-B: Social Platform`, and `DS-C: Insecure Blog`.*
>
> *Let us select `DS-A: Bank Portal` and click 'Run Security Inspection'.*
>
> *(Click Inspect)*
>
> *The simulation evaluates HTTP response headers, Content-Security-Policy (CSP), HTTP Strict Transport Security (HSTS), and secure cookie flags. It explains in simple terms why missing HSTS exposes users to SSL-stripping attacks on public Wi-Fi.*
>
> *Judges, please note the architectural guard: M4 does **not** fetch live websites. Live scanning endpoints are permanently disabled, ensuring students learn defensive header concepts safely without ever conducting unauthorized network reconnaissance."*

**Visual Focal Point:** Show the scenario selection dropdown, the simulated security findings table, and the educational explanations.

---

### Part G — Cyber Hero Journey & Adaptive Recommendations
**Estimated Time:** 1.5 Minutes (6:30 – 8:00)  
**Presenter Action:** Click the navigation link **Journey** (`#/journey`).

#### Spoken Words:
> *"Now we arrive at the heart of our experiential education: the **Cyber Hero Journey**. This is a gamified narrative campaign where students progress through ranks—from Cyber Recruit to Sentinel—by resolving realistic attack scenarios.*
>
> *Let us open **Mission 01: The Scholarship Trap**.*
>
> *(Click Mission 01)*
>
> *The student is presented with authentic artifacts: an urgent Telegram message offering an international scholarship, accompanied by a suspicious registration link. The student is asked to choose the safest defensive response.*
>
> *Let us choose the defensive action: 'Verify the announcement directly on the official university portal.'*
>
> *(Select the choice and submit)*
>
> *Immediate pedagogical feedback is provided, explaining the cognitive trick of artificial urgency, and the student earns +100 Agent XP.*
>
> *Now, let us return to the Agent Dashboard and look at the **Adaptive Learning Copilot**.*
>
> *(Scroll to the Adaptive Copilot card)*
>
> *Here, we demonstrate our third machine learning model: `ml_softmax_v1`. It analyzes student performance features—such as attempt counts, accuracy trends, and error patterns—to recommend optimal next missions. Notice the transparent user toggle: educators and students can choose between the Softmax ML Recommender and deterministic pedagogical rules.*
>
> *Crucially, our evaluation logic has strict state isolation: querying the recommender **never mutates XP, badges, or completed missions**, eliminating duplicate-reward vulnerabilities.*
>
> *If I refresh the browser right now, notice that our total XP and rank remain completely intact, preserved safely in the browser's local storage without requiring an external database connection."*

**Visual Focal Point:** Show the mission choice interface, feedback card, XP increment animation, and the Copilot toggle switch.

---

### Part H — Trilingual Parity, Privacy Summary & Conclusion
**Estimated Time:** 1.0 Minute (8:00 – 9:00)  
**Presenter Action:** Move cursor to the language selector in the top navbar.

#### Spoken Words:
> *"Finally, let us demonstrate our commitment to genuine accessibility across Ethiopia.*
>
> *In the top navigation bar, watch as I click **Afaan Oromoo**.*
>
> *(Click Afaan Oromoo)*
>
> *Every header, button, mission prompt, and assistant dialogue instantly translates into natural Afaan Oromoo.*
>
> *Now, watch as I click **አማርኛ (Amharic)**.*
>
> *(Click Amharic)*
>
> *The entire interface renders in clean Ethiopic typography. Notice that we bundle local WOFF2 font files directly within the application—no Google Fonts or external CDNs are contacted.*
>
> *Our automated test suite verifies **100% key parity** across all 2,014 dictionary keys, with zero raw key fallbacks or untranslated gaps.*
>
> *To conclude, judges:*
> - *CyberShield Ethiopia is fully implemented, verified across comprehensive backend suites and 542 frontend automated tests.*
> - *It operates 100% offline, protecting citizen privacy.*
> - *It bridges language barriers with native English, Afaan Oromoo, and Amharic support.*
> - *It integrates three genuine, inspectable machine learning models backed by reproducible metrics.*
>
> *While no software can guarantee absolute security against all evolving threats, CyberShield Ethiopia provides citizens with the cognitive armor and practical skills they need to defend themselves in our digital world.*
>
> *Thank you very much. I am now ready to answer your technical questions."*

**Visual Focal Point:** Show the Amharic and Afaan Oromoo interfaces, then return to the main dashboard for Q&A.

---

## Presentation Contingency & Troubleshooting Table

| Potential Demo Hazard | Prevention / Immediate Live Fix | Explanation for Judges |
| :--- | :--- | :--- |
| **Accidental click on non-loopback link** | All links use hash routing (`#/m1`, `#/journey`). | Explain that the SPA uses client-side hash routing for complete offline resilience. |
| **CTI Status shows `Unavailable`** | Expected behavior. Explain immediately: *CTI is unconfigured by design to demonstrate offline resilience.* | *"We intentionally operate without commercial cloud API keys so the platform never leaks URLs during demonstration."* |
| **Browser refresh during presentation** | All state resides in `localStorage`. Progress and language are preserved. | Highlight: *"Notice how local storage preserves rank and language across page reloads without database latency."* |
| **Judges ask to see real external AI (Gemini/Groq)** | Open Assistant, show the `Offline-First Engine` badge and the Settings consent modal. | *"External LLMs are strictly gated behind user consent and API keys. We deliberately keep it offline to prove self-reliance."* |

---
*End of Competition Demonstration Script.*

