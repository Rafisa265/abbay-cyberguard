# Official Brand Assets & Logos Inventory
**Platform**: ABBAY CYBERGUARD (Ethiopian Digital Safety Platform)  
**Directory**: `frontend/public/images/logos/`  
**Audit Date**: November 4, 2026  
**Auditor**: Full-Stack Security & QA Engineering Team

---

## 1. LEGAL & USAGE FRAMEWORK: NOMINATIVE FAIR USE

All vector marks stored in this directory are utilized solely for **non-commercial citizen cybersecurity education, official public authority identification, and consumer fraud triage routing** under **Nominative Fair Use** doctrine:

1. **Identification**: The marks are strictly necessary to allow Ethiopian citizens and users to unambiguously identify the legitimate official institution or technology platform responsible for securing their account or freezing stolen funds.
2. **Minimality**: Only the minimal necessary identifying device or stylized emblem is presented without extraneous embellishments.
3. **No Affiliation or Endorsement**: No sponsorship, endorsement, or formal affiliation between ABBAY CYBERGUARD and the identified entities is claimed or implied. All trademarks, service marks, and logos remain the exclusive intellectual property of their respective owners.
4. **Offline-First & Anti-Tracking Invariant**: Storing these vector marks locally within the client application ensures zero third-party telemetry, zero external network leakage, and full operational capability in offline or bandwidth-constrained environments across Ethiopia.

---

## 2. ASSET ORIGIN & AUTHENTICITY AUDIT TABLE

| Organization / Platform | Filename | Asset Origin & Authenticity Status | Official Public Reference / Brand Guidance URL | Functional Public Safety Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **INSA / Ethio-CERT** | `insa_cert.svg` | **Recreated Illustrative Vector**: Stylized cybersecurity shield, padlock, and eagle emblem created in-house for authority identification. | https://www.ethiocert.et / https://www.insa.gov.et | Identification of Ethiopian National CSIRT authority for malware, ransomware, and national infrastructure threat triage. |
| **Commercial Bank of Ethiopia (CBE)** | `cbe.svg` | **Recreated Illustrative Vector**: Geometric purple octagon with golden key silhouette modeled after CBE public branch brand palette. | https://www.combanketh.et | Fraud dispute, electronic debit block, and immediate account freezing identification. |
| **Ethio Telecom / Telebirr** | `telebirr.svg` | **Recreated Illustrative Vector**: Stylized green and orange floral geometry with official typographic mark modeled after public Telebirr assets. | https://www.ethiotelecom.et | Mobile money transaction reversal, wallet freezing, and SIM-swap fraud desk identification. |
| **Ethiopian Federal Police** | `federal_police.svg` | **Recreated Illustrative Vector**: Stylized blue roundel with golden law enforcement star and balance scales created in-house. | https://www.ethiopianfederalpolice.gov.et | Criminal investigation bureau identification for formal criminal fraud reporting and court prosecution. |
| **National Bank of Ethiopia (NBE)** | `nbe.svg` | **Neutral Regulatory Authority Seal**: In-house classical central bank facade, four stability pillars, and bilingual identifier. | https://nbe.gov.et | Financial regulatory oversight and secondary systemic consumer protection identification. |
| **Meta Platforms (Facebook)** | `facebook.svg` | **Standard Vector Geometry**: In-house vector geometry matching Meta Brand Resource Center public specifications (white 'f' on blue circle). | https://www.meta.com/brand/resources/facebook/ | Outbound link identification for official `facebook.com/hacked` account recovery portal. |
| **Meta Platforms (Instagram)** | `instagram.svg` | **Standard Vector Geometry**: In-house vector geometry matching Meta Brand Resource Center public specifications (camera contour on warm gradient). | https://www.meta.com/brand/resources/instagram/ | Outbound link identification for official `instagram.com/hacked/` account recovery portal. |
| **Microsoft Corporation** | `microsoft.svg` | **Standard Vector Geometry**: In-house vector geometry matching Microsoft Trademark & Brand Guidelines (four colored squares). | https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks | Outbound link identification for official `account.live.com/acsr` account recovery. |
| **Google LLC** | `google.svg` | **Standard Vector Geometry**: In-house vector geometry matching Google Brand Resource Center public specifications (four-color 'G' mark). | https://about.google/brand-resource-center/ | Outbound link identification for Google Account and Gmail security recovery flows. |
| **Telegram Messenger** | `telegram.svg` | **Standard Vector Geometry**: In-house vector geometry matching Telegram Brand Guidelines (white paper plane on blue disc). | https://telegram.org/faq | Outbound link identification for Telegram in-app abuse reporting and session termination. |

---

## 3. AUDIT NOTES & VERIFICATION INVARIANTS

1. **No External CDN Dependencies**: All assets are local `.svg` files served from the web server root `/images/logos/`.
2. **Explicit User Initiation**: The platform never calls any external API or submits any data to these organizations automatically. External navigation occurs strictly via user click on `<a target="_blank" rel="noopener noreferrer">` links.
3. **Neutral Replacement Ready**: In the event any entity requests cessation of nominative visual reference, the platform architecture supports immediate fallback to neutral system icons without code refactoring.
