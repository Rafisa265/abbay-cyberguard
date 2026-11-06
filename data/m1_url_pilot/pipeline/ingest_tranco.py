"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Tranco Ingestion

Acquires and standardizes candidate popular domains from Tranco.
Strictly classifies records as candidate_benign_domain (not confirmed safe URLs).
"""

import csv
import datetime
import hashlib
import io
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

from data.m1_url_pilot.pipeline.config import (
    KNOWN_MULTI_TENANT_PLATFORMS,
    MAX_BENIGN_RECORDS,
    RAW_DIR,
)
from data.m1_url_pilot.pipeline.normalize import normalize_url

TRANCO_LIST_ID = "W3ZV9"
TRANCO_SNAPSHOT = f"tranco_{TRANCO_LIST_ID}_20261025"
TRANCO_DOWNLOAD_URL = f"https://tranco-list.eu/download/{TRANCO_LIST_ID}/1000"


def fetch_or_load_tranco_raw(
    download_url: str = TRANCO_DOWNLOAD_URL,
    raw_cache_path: Optional[Path] = None,
    limit: int = MAX_BENIGN_RECORDS,
) -> str:
    """
    Fetch Tranco CSV from upstream or load from immutable raw cache.
    Does NOT visit or resolve any domain in the list.
    """
    if raw_cache_path is None:
        raw_cache_path = RAW_DIR / f"tranco_{TRANCO_LIST_ID}_top1000.csv"

    if raw_cache_path.exists():
        return raw_cache_path.read_text(encoding="utf-8")

    # Fetch top N CSV from Tranco official service
    resp = httpx.get(download_url, timeout=30.0)
    resp.raise_for_status()
    content = resp.text

    # Write immutable raw snapshot to disk
    raw_cache_path.write_text(content, encoding="utf-8")
    return content


def ingest_tranco_records(
    csv_text: str,
    limit: int = MAX_BENIGN_RECORDS,
    quarantine_multi_tenant: bool = True,
    acquired_at: Optional[str] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse Tranco CSV into standardized records.
    Returns: (accepted_records, quarantined_records)
    """
    accepted = []
    quarantined = []
    if acquired_at is None:
        raw_cache = RAW_DIR / f"tranco_{TRANCO_LIST_ID}_top1000.csv"
        if raw_cache.exists():
            acquired_at = datetime.datetime.fromtimestamp(
                raw_cache.stat().st_mtime, tz=datetime.timezone.utc
            ).isoformat()
        else:
            acquired_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    now_iso = acquired_at

    lines = [line for line in csv_text.splitlines() if line.strip()]
    reader = csv.reader(lines)
    count = 0

    for row_idx, row in enumerate(reader, start=1):
        if not row or len(row) < 2 or not row[1].strip():
            quarantined.append({
                "record_id": f"tranco:malformed:{row_idx}",
                "source": "tranco",
                "source_record_id": str(row_idx),
                "source_snapshot": TRANCO_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": ",".join(row) if row else "",
                "normalized_url": None,
                "registered_domain": None,
                "subdomain": None,
                "tld": None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "quarantine",
                "label_status": "candidate",
                "verification_status": "unverified",
                "original_data_type": "root_domain",
                "split": "quarantine",
                "quarantine_reason": "MALFORMED_CSV_ROW",
            })
            continue

        rank_str, domain = row[0].strip(), row[1].strip()
        count += 1
        if count > limit:
            break

        # Check multi-tenant quarantine policy
        if quarantine_multi_tenant and domain.lower() in KNOWN_MULTI_TENANT_PLATFORMS:
            quarantined.append({
                "record_id": f"tranco:multi_tenant:{rank_str}",
                "source": "tranco",
                "source_record_id": rank_str,
                "source_snapshot": TRANCO_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": domain,
                "normalized_url": f"http://{domain.lower()}/",
                "registered_domain": domain.lower(),
                "subdomain": None,
                "tld": domain.split(".")[-1] if "." in domain else None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "candidate_benign_domain",
                "label_status": "candidate",
                "verification_status": "multi_tenant_unverified",
                "original_data_type": "root_domain",
                "split": "quarantine",
                "quarantine_reason": "MULTI_TENANT_PLATFORM_NOT_UNIFORMLY_SAFE",
            })
            continue

        # Canonicalize domain as candidate benign URL
        norm = normalize_url(domain, default_scheme="http")
        if not norm.is_valid:
            quarantined.append({
                "record_id": f"tranco:invalid:{rank_str}",
                "source": "tranco",
                "source_record_id": rank_str,
                "source_snapshot": TRANCO_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": domain,
                "normalized_url": None,
                "registered_domain": None,
                "subdomain": None,
                "tld": None,
                "has_ip_host": False,
                "has_userinfo": False,
                "has_punycode": False,
                "label": "quarantine",
                "label_status": "candidate",
                "verification_status": "unverified",
                "original_data_type": "root_domain",
                "split": "quarantine",
                "quarantine_reason": norm.error or "NORMALIZATION_FAILED",
            })
            continue

        # Generate deterministic record ID
        rec_id = f"tranco:{rank_str}:{hashlib.sha256(norm.normalized_url.encode('utf-8')).hexdigest()[:12]}"

        record = {
            "record_id": rec_id,
            "source": "tranco",
            "source_record_id": rank_str,
            "source_snapshot": TRANCO_SNAPSHOT,
            "acquired_at": now_iso,
            "raw_url": domain,
            "normalized_url": norm.normalized_url,
            "registered_domain": norm.registered_domain or domain.lower(),
            "subdomain": norm.subdomain,
            "tld": norm.tld,
            "has_ip_host": norm.has_ip_host,
            "has_userinfo": norm.has_userinfo,
            "has_punycode": norm.has_punycode,
            "label": "candidate_benign_domain",
            "label_status": "candidate",
            "verification_status": "tranco_ranked_pld",
            "original_data_type": "root_domain",
            "split": None,
            "quarantine_reason": None,
        }
        accepted.append(record)

    return accepted, quarantined
