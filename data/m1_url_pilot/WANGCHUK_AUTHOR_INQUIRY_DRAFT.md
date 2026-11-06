# CyberShield Ethiopia — Wangchuk (2026) Dataset Licensing Inquiry Draft

**Status Note:** `DRAFT — NOT SENT; PERMISSIONS UNRESOLVED; NO DATASET ACQUIRED`  
**Document Type:** Pre-Acquisition Governance Artifact & Ready-to-Send Author Inquiry  
**Project Name:** CyberShield Ethiopia  
**Project Owner / Researcher:** Lalisa Gadafa  
**Academic Affiliation:** Software Engineering, Institute of Technology, Arba Minch University, Ethiopia *(Individual researcher affiliation; not a university-sponsored or institutionally endorsed project)*  
**Project Purpose:** Cybersecurity education and the M1 URL-security research pilot  
**Target Dataset:** Phishing URL Dataset (Wangchuk, 2026)  
**Platform / Repository:** Mendeley Data, V1  
**DOI:** [10.17632/3jddhy2f6s.1](https://doi.org/10.17632/3jddhy2f6s.1)  
**Author Information:** Tandin Wangchuk (Sherubtse College, Royal University of Bhutan) & Tad Gonsalves (Sophia University)  
*(Note: Author contact details and recipient identity must be independently verified by the project owner using official publication records or institutional profiles prior to sending)*  
**Module Context:** CyberShield Ethiopia — M1 URL Threat Assessment & Pilot Detection Pipeline  

---

## 1. Document Purpose & Governance Overview

This document provides the finalized, ready-to-send licensing inquiry to be manually reviewed and dispatched by project owner Lalisa Gadafa to the dataset author and authorized rights holders.

### Core Governance Boundaries
- **Status:** Draft only. The inquiry has **not** been sent. No permission has been assumed or granted.
- **Data Status:** **Zero bytes of the dataset have been downloaded, acquired, sampled, or ingested.**
- **Proposed Initial Sample Ceiling:** Strictly capped at **no more than 1,000 records** for initial offline validation, proposed strictly subject to prior written approval (not asserted as an existing entitlement).
- **Offline Ingestion Boundary:** 100% offline-only processing. The pipeline never visits candidate URLs, crawls websites, or performs outbound DNS, HTTP, or network probing lookups.
- **Privacy & External Services:** No sensitive information, user data, or telemetry will ever be sent to external services or third parties.
- **Public URL Restriction Awareness:** Publicly available URLs are not automatically treated as free of copyright, privacy, contractual, or other restrictions.
- **Intended Use:** Educational cybersecurity research and offline phishing detection modeling (M1 URL-security research pilot), exploring whether an authorized subset can support feature extraction, benchmark evaluation, and classifier/ML model training, with potential future integration of trained model parameters (never raw data) into educational or public security tools.
- **Zero Raw Data Redistribution:** The project will **not** redistribute, publish, or resell raw dataset records, URL strings, or the compiled dataset.

---

## 2. Fact Verification & Licensing Ambiguities

### A. Verified Facts (Local & Authoritative Records)
1. **Researcher & Affiliation:** Project owner Lalisa Gadafa, affiliated with Software Engineering, Institute of Technology, Arba Minch University, Ethiopia (individual academic affiliation).
2. **Project Identity:** CyberShield Ethiopia (educational, offline-first cybersecurity project; M1 module studies URL-related phishing risks).
3. **Dataset Identification:** Published on Mendeley Data under DOI `10.17632/3jddhy2f6s.1` as "Phishing URL Dataset" (Wangchuk, 2026).
4. **Repository Stated License:** The Mendeley repository metadata indicates Creative Commons Attribution 4.0 International (CC BY 4.0).
5. **Upstream Provenance:** The dataset documentation identifies phishing URLs sourced from PhishTank and legitimate URLs observed from Common Crawl (`CC-MAIN-2024-33`).
6. **Technical Pipeline Invariants:** The offline ingestion adapter (`ingest_wangchuk.py`) is verified and passes all synthetic tests. All protected baseline dataset files and integrity hashes remain unmodified.

### B. Unresolved Legal & Licensing Questions
1. **Compilation vs. Component Rights:** Whether the CC BY 4.0 license covers individual raw URL strings or solely the compilation, selection, and precomputed feature schema.
2. **Third-Party Upstream Restrictions:** PhishTank terms from Cisco Talos traditionally impose non-commercial restrictions. Whether the author has a specific waiver or whether downstream deployment of trained models requires separate Cisco Talos clearance remains unverified.
3. **Commercial Deployment of Trained Weights:** Whether deploying inference services using model parameters (weights) derived from this dataset constitutes an authorized derivative work under CC BY 4.0.
4. **Data Retention & Deletion:** Whether any periodic URL takedown, retention limits, or deletion obligations apply to historical URL records.
5. **Conditions, Scope, & Term:** Whether the permission has any expiration date, geographic scope, institutional requirements, or other conditions.
6. **Formal Documentation Requirements:** Whether a formal data license agreement, institutional review, or additional documentation is required.

---

## 3. Inquiry Questions Checklist

The finalized email in Section 4 systematically addresses all 14 required legal and governance points:
- [x] **1. Access and Downloading:** Asks whether downloading and accessing the dataset are permitted for the proposed research pilot.
- [x] **2. Local Retention and Duration:** Asks whether retaining a local research copy is permitted and for what duration.
- [x] **3. Sample Size and Subset Selection:** Proposes an initial subset of up to 1,000 records and asks whether this limit is acceptable or if a different limit is required.
- [x] **4. Data Cleaning and Transformation:** Asks whether cleaning, canonicalizing, normalizing, deduplicating, or transforming records is permitted.
- [x] **5. Feature Derivation and Aggregate Metrics:** Asks whether extracting structural features and generating aggregate evaluation statistics are permitted.
- [x] **6. Classifier and Detection Development:** Asks whether the dataset may be used to develop or evaluate a phishing-URL classifier, including a machine learning model.
- [x] **7. Model Training and Parameter Retention:** Asks whether model training, offline validation, and the retention of trained model parameters (weights) are covered.
- [x] **8. Academic and Educational Scope:** Clarifies whether permitted use is restricted to non-commercial academic or educational research.
- [x] **9. Commercial Use and Public Deployment:** Clarifies whether commercial use or public-facing deployment of trained model parameters is prohibited, requires separate authorization, or is governed by another license.
- [x] **10. Redistribution Restrictions:** Clarifies redistribution terms for derived datasets and model artifacts, while reassuring that raw URL records will not be redistributed.
- [x] **11. Attribution, Citation, and Notices:** Inquires regarding specific copyright notices, license texts, or acknowledgements required beyond standard citation.
- [x] **12. Third-Party and Upstream Material:** Inquires whether upstream data components (PhishTank / Cisco Talos, Common Crawl) carry separate restrictions or require independent clearance.
- [x] **13. Conditions, Scope, and Expiration:** Inquires whether the permission has any expiration date, geographic scope, institutional requirements, or other conditions.
- [x] **14. Formal Agreement or Rights Referral:** Inquires whether formal license agreements or institutional approvals are required, and requests referral to appropriate rights holders or alternative datasets if permission cannot be granted.

---

## 4. Final Ready-to-Send Email Text

*Note for Project Owner (Lalisa Gadafa): Review the text below, verify the recipient's official contact email through official publication channels or Mendeley Data, replace `[Insert your verified institutional/contact email]` with your active email address, and send manually from your own account.*

```text
Subject: Licensing and usage permission inquiry regarding Phishing URL Dataset (DOI: 10.17632/3jddhy2f6s.1)

Dear Dataset Author and Rights Holder,

I am Lalisa Gadafa, an individual researcher affiliated with Software Engineering at the Institute of Technology, Arba Minch University, Ethiopia. I am writing in connection with CyberShield Ethiopia, an educational, offline-first cybersecurity project whose M1 module studies URL-related phishing risks, public safety awareness, and digital literacy. Please note that this is an independent academic research inquiry and does not represent an institutional endorsement or formal sponsorship by Arba Minch University.

We are reviewing the dataset titled "Phishing URL Dataset" (Wangchuk, 2026), published on Mendeley Data under DOI 10.17632/3jddhy2f6s.1. Before downloading, acquiring, sampling, or processing any data, I am writing to seek your formal written guidance and authorization regarding the applicable licensing terms, third-party rights, and permitted research uses.

Subject to your explicit written authorization, we propose a strictly bounded research pilot to evaluate whether an authorized subset could support research and evaluation for M1 phishing-URL detection. Specifically, our proposed handling includes:
- Proposed initial sample ceiling: An authorized subset of no more than 1,000 records.
- 100% offline and local handling: All processing will operate locally and offline. No live target URLs will be opened or resolved, no web crawling or DNS probing will occur, and no sensitive data will be sent to external services.
- Publicly available URLs will not automatically be treated as free of copyright, privacy, contractual, or other restrictions, and all data will remain subject to source licensing and data governance.
- Zero raw data redistribution: We will NOT redistribute, publish, or resell raw URL records or the compiled dataset.
- Scope of evaluation: Exploring whether the authorized sample can be used for offline feature derivation, benchmark evaluation, and classifier/ML model training, with the potential future possibility of incorporating trained model parameters (never raw data) into educational or public security tools.

To ensure strict compliance with your terms and any applicable third-party licenses, could you kindly provide written clarification on the following questions?

1. Dataset Access & Downloading:
   Is downloading and accessing the dataset permitted for this proposed educational research pilot?

2. Local Retention & Duration:
   Is retaining a local research copy of the dataset permitted, and if so, for what duration (or are there periodic deletion/retention limits)?

3. Sample Size & Subset Selection:
   Is selecting an initial research sample of up to 1,000 records permitted, or do you require a different sample ceiling or selection protocol?

4. Data Cleaning & Transformation:
   Is cleaning, canonicalizing, normalizing, deduplicating, or transforming records permitted?

5. Feature Derivation & Aggregate Metrics:
   Is extracting structural lexical features and computing aggregate evaluation statistics permitted?

6. Classifier & Detection Development:
   May the dataset be used to develop or evaluate a phishing-URL classifier, including a machine learning model?

7. Model Training & Parameter Retention:
   Are model training, offline validation, and the retention of trained model parameters (weights) covered by the proposed permission?

8. Academic & Educational Scope:
   Is the permitted use restricted solely to non-commercial academic or educational research?

9. Commercial Use & Public Deployment:
   Is commercial use or public-facing deployment of trained model parameters prohibited, subject to separate authorization, or governed by another license?

10. Redistribution Restrictions:
    What specific restrictions govern derived datasets or model artifacts? (We confirm that we will NOT redistribute or publish raw URL records or the compiled dataset.)

11. Attribution, Citation, & Notices:
    Beyond the standard citation (Wangchuk, 2026, Mendeley Data, DOI: 10.17632/3jddhy2f6s.1), what specific copyright notices, license texts, or acknowledgements are required in project documentation or model release notes?

12. Third-Party & Upstream Terms:
    Do upstream data components (such as records sourced from PhishTank / Cisco Talos or Common Crawl) carry separate licenses, restrictions, or require independent clearance?

13. Conditions, Scope, & Expiration:
    Does the permission carry any expiration date, geographic scope, institutional requirements, or other conditions?

14. Formal Documentation or Rights Referral:
    Is a formal license agreement, institutional approval, or additional documentation required? If you do not control the necessary rights to authorize all or part of this use, could you kindly direct us to the appropriate rights holder, or suggest an alternative dataset with suitable permissions?

We maintain a strict fail-closed data governance policy: our project will not download, acquire, integrate, redistribute, or use the dataset for model training until applicable permissions and license terms have been clarified and authorized in writing.

Thank you very much for your time, consideration, and guidance.

Kind regards,

Lalisa Gadafa
Project Lead, CyberShield Ethiopia
Department of Software Engineering, Institute of Technology
Arba Minch University, Ethiopia
[Insert your verified institutional/contact email]
[Insert verified project URL or note: No public project URL available]
```

---

## 5. Next Actions for Project Owner (Lalisa Gadafa)

1. **Review Email Text:** Review the finalized inquiry draft in Section 4 to confirm that the described research pilot, proposed 1,000-record sample ceiling, and educational scope align with project objectives.
2. **Independently Verify Recipient Details:** Independently verify the official contact channel for author Tandin Wangchuk via Mendeley Data, official institutional faculty profiles (Sherubtse College, Royal University of Bhutan), or authoritative publication records. *Do not guess, fabricate, or assume unverified contact addresses.*
3. **Fill in Genuine Sender Details Only:** Replace `[Insert your verified institutional/contact email]` in the email text with your active, genuine institutional email address. Do not invent unverified affiliations, endorsements, or credentials.
4. **Send Inquiry Manually:** Send the inquiry manually from your own academic or official project email account, or dispatch via Mendeley Data's official author contact interface. *Do not use automated sending scripts.*
5. **Preserve Sent Record & Written Response:** Preserve and archive the sent email message and any written reply received in `data/m1_url_pilot/manifests/` for transparent provenance tracking.
6. **Review Terms Before Any Acquisition:** Ensure the written reply and applicable license conditions are thoroughly reviewed and documented before enabling any dataset downloading, acquisition, or pipeline ingestion. All acquisition and training remain strictly blocked until written authorization is verified.
