"""
CyberShield Ethiopia — M1 URL Dataset Pilot: URLhaus Ingestion Adapter

Safe, isolated ingestion adapter for abuse.ch URLhaus threat feeds.
Strictly requires explicit phishing classification (threat='phishing' or tag='phishing').
Never conflates generic malware distribution URLs with phishing lures.
Zero target URL lookups, zero outbound network probing, finite timeout & size bounds.
"""

import csv
import datetime
import hashlib
import io
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

from data.m1_url_pilot.pipeline.config import (
    MAX_PHISHING_RECORDS,
    RAW_DIR,
)
from data.m1_url_pilot.pipeline.normalize import normalize_url

URLHAUS_LEGACY_URL = "https://urlhaus.abuse.ch/downloads/csv_recent/"
URLHAUS_API_BASE = "https://urlhaus-api.abuse.ch/v2/files/exports"
URLHAUS_TERMS = (
    "abuse.ch Terms of Use (effective Nov 4, 2025, updated Oct 21, 2026). "
    "Free for not-for-profit purposes under Fair Use Principles. "
    "Commercial use requires paid Spamhaus subscription. NOT CC0."
)
URLHAUS_SNAPSHOT = "urlhaus_abuse_ch_feed"
MAX_FEED_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB safety ceiling
TIMEOUT_SECONDS = 30.0


def check_urlhaus_availability() -> Tuple[bool, str]:
    """
    Check if URLhaus data is safely accessible without violating repository boundaries.
    """
    raw_local_file = RAW_DIR / "urlhaus_recent.csv"
    if raw_local_file.exists():
        return True, f"Found local raw cache at {raw_local_file}"

    auth_key = os.getenv("CYBERSHIELD_URLHAUS_AUTH_KEY", "").strip()
    if auth_key:
        return True, "URLhaus Auth-Key configured in environment"

    return False, (
        "Legacy endpoint https://urlhaus.abuse.ch/downloads/csv_recent/ returned HTTP 410 Gone. "
        "abuse.ch Terms of Use (effective Nov 2025 / updated Oct 2026) require an Auth-Key from "
        "https://auth.abuse.ch/ for database export downloads. No key is configured in the environment. "
        "Per strict repository boundaries, live download is skipped."
    )


def fetch_urlhaus_feed(
    auth_key: Optional[str] = None,
    raw_cache_path: Optional[Path] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Fetch URLhaus CSV feed over HTTPS with strict timeout and size limits.
    Returns: (csv_text, sha256_checksum, error_message)
    """
    if raw_cache_path is None:
        raw_cache_path = RAW_DIR / "urlhaus_recent.csv"

    if raw_cache_path.exists():
        content = raw_cache_path.read_text(encoding="utf-8", errors="replace")
        checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()
        return content, checksum, None

    if not auth_key:
        auth_key = os.getenv("CYBERSHIELD_URLHAUS_AUTH_KEY", "").strip()

    if not auth_key:
        return None, None, "AUTH_KEY_REQUIRED: No URLhaus Auth-Key available"

    download_url = f"{URLHAUS_API_BASE}/{auth_key}/recent.csv"

    try:
        with httpx.stream("GET", download_url, timeout=TIMEOUT_SECONDS, follow_redirects=False) as resp:
            if resp.status_code != 200:
                return None, None, f"HTTP_{resp.status_code}: Upstream feed request rejected"

            chunks = []
            total_bytes = 0
            for chunk in resp.iter_bytes(1024 * 64):
                total_bytes += len(chunk)
                if total_bytes > MAX_FEED_SIZE_BYTES:
                    return None, None, f"FEED_EXCEEDS_MAX_SIZE: Feed size exceeds {MAX_FEED_SIZE_BYTES} bytes"
                chunks.append(chunk)

            raw_bytes = b"".join(chunks)
            content = raw_bytes.decode("utf-8", errors="replace")
            checksum = hashlib.sha256(raw_bytes).hexdigest()

            # Cache raw immutable snapshot
            raw_cache_path.write_text(content, encoding="utf-8")
            return content, checksum, None

    except Exception as e:
        return None, None, f"NETWORK_ERROR: {type(e).__name__}: {str(e)}"


def parse_urlhaus_csv(
    csv_text: str,
    limit: int = MAX_PHISHING_RECORDS,
    content_checksum: Optional[str] = None,
    acquired_at: Optional[str] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse official URLhaus CSV schema:
    # id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter

    Strict policy:
    - Only records with explicit threat='phishing' or 'phishing' tag are accepted as phishing.
    - Generic malware_download URLs are quarantined with URLHAUS_NON_PHISHING_MALWARE.
    - Offline or unknown status records are quarantined.
    - Malformed or invalid URLs are quarantined.

    Returns:
        (accepted_phishing_records, quarantined_records)
    """
    accepted = []
    quarantined = []
    if acquired_at is None:
        raw_cache = RAW_DIR / "urlhaus_recent.csv"
        if raw_cache.exists():
            acquired_at = datetime.datetime.fromtimestamp(
                raw_cache.stat().st_mtime, tz=datetime.timezone.utc
            ).isoformat()
        else:
            acquired_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    now_iso = acquired_at

    lines = [line for line in csv_text.splitlines() if line.strip() and not line.startswith("#")]
    reader = csv.reader(lines)

    for row_idx, row in enumerate(reader, start=1):
        if not row or len(row) < 8:
            quarantined.append({
                "record_id": f"urlhaus:malformed:{row_idx}",
                "source": "urlhaus",
                "source_record_id": str(row_idx),
                "source_snapshot": URLHAUS_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": "",
                "normalized_url": None,
                "registered_domain": None,
                "subdomain": None,
                "tld": None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "quarantine",
                "label_status": "unverified",
                "verification_status": "unverified",
                "original_data_type": "full_url",
                "split": "quarantine",
                "quarantine_reason": f"MALFORMED_CSV_ROW: Expected >= 8 columns, got {len(row)}",
            })
            continue

        # Standard URLhaus CSV columns
        source_id = row[0].strip()
        dateadded = row[1].strip()
        raw_url = row[2].strip()
        url_status = row[3].strip().lower()
        last_online = row[4].strip()
        threat = row[5].strip().lower()
        tags_raw = row[6].strip()
        urlhaus_link = row[7].strip()
        reporter = row[8].strip() if len(row) > 8 else "anonymous"

        tags = [t.strip().lower() for t in tags_raw.split(";") if t.strip()]

        # 1. Status Filter: must be online
        if url_status != "online":
            quarantined.append({
                "record_id": f"urlhaus:offline:{source_id}",
                "source": "urlhaus",
                "source_record_id": source_id,
                "source_snapshot": URLHAUS_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": raw_url,
                "normalized_url": None,
                "registered_domain": None,
                "subdomain": None,
                "tld": None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "quarantine",
                "label_status": "unverified",
                "verification_status": "unverified",
                "original_data_type": "full_url",
                "split": "quarantine",
                "quarantine_reason": f"OFFLINE_URLHAUS_RECORD (status={url_status})",
            })
            continue

        # 2. Threat Classification Filter:
        # Crucial safeguard: Do not label generic malware-download URLs as phishing!
        is_phishing = (threat == "phishing") or ("phishing" in tags)

        if not is_phishing:
            # Documented quarantine: record is malware distribution, NOT phishing
            quarantined.append({
                "record_id": f"urlhaus:malware_not_phish:{source_id}",
                "source": "urlhaus",
                "source_record_id": source_id,
                "source_snapshot": URLHAUS_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": raw_url,
                "normalized_url": None,
                "registered_domain": None,
                "subdomain": None,
                "tld": None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "quarantine",
                "label_status": "candidate",
                "verification_status": "urlhaus_malware_distribution",
                "original_data_type": "full_url",
                "split": "quarantine",
                "quarantine_reason": f"URLHAUS_NON_PHISHING_MALWARE (threat={threat}, tags={tags_raw})",
            })
            continue

        # 3. Canonicalize URL
        norm = normalize_url(raw_url)
        if not norm.is_valid:
            quarantined.append({
                "record_id": f"urlhaus:invalid:{source_id}",
                "source": "urlhaus",
                "source_record_id": source_id,
                "source_snapshot": URLHAUS_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": raw_url,
                "normalized_url": None,
                "registered_domain": None,
                "subdomain": None,
                "tld": None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "quarantine",
                "label_status": "unverified",
                "verification_status": "unverified",
                "original_data_type": "full_url",
                "split": "quarantine",
                "quarantine_reason": norm.error or "NORMALIZATION_FAILED",
            })
            continue

        rec_id = f"urlhaus:{source_id}:{hashlib.sha256(norm.normalized_url.encode('utf-8')).hexdigest()[:12]}"

        record = {
            "record_id": rec_id,
            "source": "urlhaus",
            "source_record_id": source_id,
            "source_snapshot": URLHAUS_SNAPSHOT,
            "acquired_at": now_iso,
            "raw_url": raw_url,
            "normalized_url": norm.normalized_url,
            "registered_domain": norm.registered_domain,
            "subdomain": norm.subdomain,
            "tld": norm.tld,
            "has_ip_host": norm.has_ip_host,
            "has_userinfo": norm.has_userinfo,
            "has_punycode": norm.has_punycode,
            "label": "phishing",
            "label_status": "verified",
            "verification_status": "urlhaus_verified_phishing",
            "original_data_type": "full_url",
            "split": None,
            "quarantine_reason": None,
            "_metadata": {
                "dateadded": dateadded,
                "last_online": last_online,
                "threat": threat,
                "tags": tags,
                "reporter": reporter,
                "urlhaus_link": urlhaus_link,
                "content_checksum": content_checksum,
            },
        }
        accepted.append(record)

        if len(accepted) >= limit:
            break

    return accepted, quarantined
