# CyberShield Ethiopia — Local Threat Intelligence Feed Administrator Runbook

This runbook guides system administrators and security operations personnel on obtaining, converting, validating, deploying, and maintaining an authorized offline Cyber Threat Intelligence (CTI) feed for the CyberShield Ethiopia platform.

---

## 1. Overview & Architecture

The CyberShield Ethiopia M1 Link Checker features an **offline-first local threat intelligence engine** (`LocalFeedCTIAdapter`). 

### Core Architectural Guarantees:
1. **Zero Outbound Network Traffic**: During a user link-check request, the server makes **zero** outbound HTTP/HTTPS requests, **zero** DNS queries, and **zero** socket connections. User lookups are 100% evaluated against the local memory-mapped database.
2. **Absolute User Privacy**: URLs, domain names, query parameters, credentials, and authentication tokens submitted by users are never transmitted to third parties or logged to disk.
3. **Local Heuristic Independence**: The client-side and backend heuristic analysis rules continue to execute autonomously. If the local threat intelligence feed is unavailable, missing, or empty, the heuristic assessment remains completely intact.
4. **Hot Reloading**: The backend monitors the filesystem timestamp (`mtime`) of the feed file. When an administrator atomically updates the feed file, the backend reloads the database into memory without server restarts or downtime.
5. **No Threat Found $\neq$ Safe**: If a URL is checked and no match is found in the local feed, the platform explicitly classifies the result as `no_threat_found` and clearly displays that absence of known threat intelligence does not guarantee a link is safe.

---

## 2. Feed Licensing, Source Selection & Redistribution Terms

### URLhaus (abuse.ch) Licensing & Access Analysis
- **Provider**: abuse.ch URLhaus project.
- **Data Offered**: Continuously updated database of verified malware distribution sites and malicious URLs.
- **Access Conditions**:
  - Requires registration and generation of a personal API key (**Auth-Key**) to perform bulk database downloads and high-volume queries.
  - abuse.ch terms grant free access for non-commercial cybersecurity defense, incident response, and research.
- **Redistribution Restrictions**:
  - Raw bulk database snapshots from URLhaus **may not be redistributed** in open git repositories or bundled inside third-party application distributions without explicit written agreement from abuse.ch.
  - To respect licensing and attribution constraints and avoid publishing stale threat data, **CyberShield Ethiopia does not bundle raw bulk threat snapshots in version control**.
- **Approved Operating Model**:
  - The platform provides a decoupled, local-feed loader.
  - The authorized organization or operator downloads their own fresh feed snapshot under their registered credentials, converts it to the CyberShield schema, and deploys it to the server.

---

## 3. CyberShield Local Feed JSON Schema Specification

The local feed file must be a single UTF-8 encoded JSON object matching the following structure:

```json
{
  "feed_format_version": "1.0",
  "feed_name": "Organization Local Threat Intelligence Feed",
  "feed_updated_at": "2026-10-23T08:00:00Z",
  "source": "urlhaus_local_sync",
  "description": "Verified offline threat database snapshot for CyberShield Ethiopia",
  "records": [
    {
      "type": "domain",
      "target": "example-malicious-domain.com",
      "threat_type": "MALWARE"
    },
    {
      "type": "url",
      "target": "https://compromised-site.org/downloads/stealer.exe",
      "threat_type": "MALWARE"
    },
    {
      "type": "domain",
      "target": "ethiopia-bank-phish.net",
      "threat_type": "SOCIAL_ENGINEERING"
    }
  ]
}
```

### Top-Level Field Definitions
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `feed_format_version` | String | Yes | Must be `"1.0"`. |
| `feed_name` | String | Optional | Descriptive human-readable title for the feed. |
| `feed_updated_at` | String | Recommended | ISO-8601 UTC timestamp of when the feed data was generated. Displayed to users in the UI as the feed version. |
| `source` | String | Optional | Source identifier (e.g. `urlhaus_local_sync`, `internal_cert_feed`). |
| `description` | String | Optional | Administrative notes, snapshot scope, or licensing attribution. |
| `records` | Array | Yes | Non-empty array of threat indicator objects. |

### Record Field Definitions
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | String | Yes | Indicator category: `"domain"` or `"url"`. |
| `target` | String | Yes | The malicious domain name or URL string. |
| `threat_type` | String | Optional | Threat classification (defaults to `"MALWARE"` if omitted). Standard values: `"MALWARE"`, `"SOCIAL_ENGINEERING"`, `"UNWANTED_SOFTWARE"`. |

---

## 4. Exact Validation & Matching Semantics

### Validation Rules Enforced by `LocalFeedCTIAdapter`
1. **File Existence**: The configured file path must exist and be a regular file. Missing files return `unavailable` (`FEED_MISSING`).
2. **File Size & Content**: Zero-byte files or whitespace-only files return `unavailable` (`FEED_EMPTY`).
3. **JSON Syntax**: Malformed JSON documents return `unavailable` (`FEED_MALFORMED`).
4. **Root Type**: Root JSON element must be an object (not an array or primitive).
5. **Records Array**: The `records` property must be a list containing at least one valid record. An empty records array returns `unavailable` (`FEED_EMPTY`).
6. **Root-TLD Protection**: Domain indicators must contain at least one dot (`.` in domain). Single-label targets (e.g. `"com"`, `"org"`, `"local"`) are rejected to prevent accidental blanket blocking of entire top-level domains.
7. **Failure Isolation**: Any reload failure immediately flushes existing in-memory threat tables and marks the adapter as `unavailable`. It will **never** silently report `no_threat_found` when a feed is broken or empty.

### Multi-Tier Matching Engine
When a user evaluates a URL (e.g. `https://login.example-phish.com:443/auth/step1?token=secret#top`), the engine executes three deterministic matching tiers:
1. **Tier 1 — Canonical URL Match**: Compares the canonicalized URL against all indexed URL records.
2. **Tier 2 — Query-Stripped Path Match**: Compares `https://login.example-phish.com/auth/step1` against path URL records.
3. **Tier 3 — Hostname Hierarchy Match**:
   - Hostname `login.example-phish.com` is decomposed along label boundaries:
     - `login.example-phish.com`
     - `example-phish.com`
   - If any parent domain exists in the domain threats table, it triggers a `known_malicious` result.
   - **Safe Boundary Guarantee**: Substring collisions like `notexample-phish.com` or `example-phish.com.legitbank.com` **never** match.

---

## 5. Manual Feed Acquisition & Conversion

Administrators can use the following standalone offline conversion utility to transform downloaded threat lists (in either JSON or CSV format) into the CyberShield JSON schema.

### Step 1: Download Fresh Indicators (Operator Workstation)
Download fresh indicators using either the URLhaus API or direct export:

```bash
# Option A: API export (JSON format, requires registered Auth-Key)
curl -X POST https://urlhaus-api.abuse.ch/v1/urls/recent/ \
     -H "Auth-Key: YOUR_AUTHORIZED_API_KEY" \
     -o urlhaus_recent.json

# Option B: Direct feed download (CSV format)
curl https://urlhaus.abuse.ch/downloads/csv_recent/ \
     -o urlhaus_recent.csv
```

### Step 2: Convert to CyberShield Schema
Save and run the following standalone script (e.g. `convert_feed.py`):

```python
#!/usr/bin/env python3
"""CyberShield Ethiopia - Offline Threat Feed Converter.

Converts external URLhaus feeds (both JSON and CSV exports) into the
validated CyberShield offline JSON feed schema.
Standard library only — zero external dependencies.
"""
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def _parse_urlhaus_json(content: str) -> list[dict]:
    """Parses URLhaus API JSON response containing a 'urls' array."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Input is not valid JSON: {exc}") from exc

    if not isinstance(data, dict) or "urls" not in data or not isinstance(data["urls"], list):
        raise ValueError("Invalid URLhaus JSON schema: expected root object with 'urls' array.")

    records = []
    for item in data["urls"]:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        threat = str(item.get("threat") or "MALWARE").strip().upper()
        if url:
            records.append({"url": url, "threat": threat})
    return records


def _parse_urlhaus_csv(content: str) -> list[dict]:
    """Parses URLhaus CSV export, skipping comments and resolving headers."""
    lines = content.splitlines()
    data_lines = []
    url_idx = 2      # Default URLhaus CSV column 2: url
    threat_idx = 5   # Default URLhaus CSV column 5: threat

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            # Check if this comment row defines the CSV column headers
            header_text = stripped.lstrip("#").strip()
            if "url" in header_text.lower() and "threat" in header_text.lower():
                reader = csv.reader([header_text])
                cols = [c.strip().lower() for c in next(reader, [])]
                if "url" in cols:
                    url_idx = cols.index("url")
                if "threat" in cols:
                    threat_idx = cols.index("threat")
            continue
        data_lines.append(stripped)

    if not data_lines:
        raise ValueError("URLhaus CSV contains no data rows.")

    records = []
    reader = csv.reader(data_lines)
    for row in reader:
        if len(row) <= url_idx:
            continue
        url = row[url_idx].strip()
        threat = row[threat_idx].strip().upper() if len(row) > threat_idx else "MALWARE"
        if url:
            records.append({"url": url, "threat": threat})
    return records


def convert_urlhaus_to_cybershield(input_path: str, output_path: str) -> None:
    src = Path(input_path)
    if not src.is_file():
        print(f"Error: Source file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    content = src.read_text(encoding="utf-8").strip()
    if not content:
        print(f"Error: Source file is empty: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Automatically detect format by extension and content inspection
    if src.suffix.lower() == ".json" or content.startswith("{") or content.startswith("["):
        raw_items = _parse_urlhaus_json(content)
        source_label = "abuse.ch_urlhaus_api_json"
    else:
        raw_items = _parse_urlhaus_csv(content)
        source_label = "abuse.ch_urlhaus_csv"

    if not raw_items:
        raise ValueError(f"Conversion failed: 0 indicators extracted from {input_path}")

    records = []
    seen = set()

    for item in raw_items:
        raw_url = item["url"]
        threat = item["threat"]

        # Normalize threat types to CyberShield taxonomy
        if threat in ("PHISHING", "SOCIAL_ENGINEERING"):
            threat = "SOCIAL_ENGINEERING"
        elif threat in ("MALWARE", "MALWARE_DOWNLOAD"):
            threat = "MALWARE"
        elif not threat:
            threat = "MALWARE"

        if raw_url not in seen:
            seen.add(raw_url)
            records.append({
                "type": "url",
                "target": raw_url,
                "threat_type": threat,
            })

    output_feed = {
        "feed_format_version": "1.0",
        "feed_name": "URLhaus Offline Threat Feed Snapshot",
        "feed_updated_at": datetime.now(timezone.utc).isoformat(),
        "source": source_label,
        "description": "Converted offline threat intelligence indicators for CyberShield Ethiopia.",
        "records": records,
    }

    dst = Path(output_path)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(output_feed, indent=2), encoding="utf-8")
    print(f"Successfully converted {len(records)} indicators from {input_path} to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_feed.py <input_feed.json|csv> <output_threat_feed.json>")
        sys.exit(1)
    try:
        convert_urlhaus_to_cybershield(sys.argv[1], sys.argv[2])
    except Exception as exc:
        print(f"Conversion Error: {exc}", file=sys.stderr)
        sys.exit(1)
```

#### Safe Usage Examples:
```bash
# Convert JSON input:
python convert_feed.py urlhaus_recent.json backend/app/data/threat_feed.json

# Convert CSV input:
python convert_feed.py urlhaus_recent.csv backend/app/data/threat_feed.json
```

### Step 3: Validate the Generated Feed
Verify the actual output file before deployment:

```bash
python -c "
import json, sys
target_path = sys.argv[1] if len(sys.argv) > 1 else 'backend/app/data/threat_feed.json'
with open(target_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
assert data.get('feed_format_version') == '1.0', 'Invalid feed_format_version'
records = data.get('records', [])
assert isinstance(records, list) and len(records) > 0, 'Feed contains zero records'
print(f'Verification passed: {len(records)} valid records in {target_path}')
" backend/app/data/threat_feed.json
```

---

## 6. Deployment & Atomic File Update

To prevent race conditions during updates, **never edit or stream data directly into the active feed file**. Always use atomic filesystem replacement:

### Linux / macOS:
```bash
# Atomically replace target file in repository root
mv new_threat_feed.json backend/app/data/threat_feed.json
```

### Windows (PowerShell):
```powershell
Move-Item -Force -Path .\new_threat_feed.json -Destination .\backend\app\data\threat_feed.json
```

When the file is replaced, the backend detects the new `st_mtime` on the next query and automatically reloads the memory index.

---

## 7. Environment Configuration

In your server's `.env` configuration file:

```ini
# Select 'auto' to automatically activate local_feed when a valid feed file exists
CYBERSHIELD_CTI_PROVIDER=auto

# Path to the deployed threat intelligence feed
CYBERSHIELD_CTI_LOCAL_FEED_PATH=backend/app/data/threat_feed.json
```

To force exclusive use of the local feed (and fail fast to `unavailable` if missing):
```ini
CYBERSHIELD_CTI_PROVIDER=local_feed
```

---

## 8. Synthetic Test Indicators vs. Production Intelligence

| Category | Storage Location | Permitted Usage | Example |
| :--- | :--- | :--- | :--- |
| **Synthetic Test Indicators** | `backend/tests/test_m1_cti.py` | Strictly for automated unit/integration tests. Must use `.testing` or `.test` domains. | `malicious-bank.testing` |
| **Feed Structural Template** | `backend/app/data/threat_feed.template.json` | Sample structure. Intentionally contains 0 records. Returns `unavailable`. | `"records": []` |
| **Production Feed** | `backend/app/data/threat_feed.json` (untracked) | Operational threat intelligence from authorized providers. | Real verified threats |

> [!CAUTION]
> Never mix synthetic test fixtures into the production threat feed, and never commit real operational threat feeds to version control.
