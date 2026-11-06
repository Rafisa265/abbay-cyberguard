"""
CyberShield Ethiopia — M1 URL Dataset Pilot: PhishTank Ingestion

Parses verified phishing records from PhishTank data schema.
Strictly requires both verified == yes AND online == yes.
Does NOT contact PhishTank APIs without a safely configured API key.
"""

import datetime
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from data.m1_url_pilot.pipeline.config import (
    MAX_PHISHING_RECORDS,
    RAW_DIR,
)
from data.m1_url_pilot.pipeline.normalize import normalize_url

PHISHTANK_DEV_URL = "https://phishtank.org/developer_info.php"
PHISHTANK_SNAPSHOT = "phishtank_talos_feed"


def check_phishtank_availability() -> Tuple[bool, str]:
    """
    Check if PhishTank acquisition can safely proceed.
    Per instructions: If PhishTank requires an API key that is not already safely
    available, do not request, invent, hard-code, or store a key.
    """
    raw_local_file = RAW_DIR / "phishtank_online_valid.json"
    if raw_local_file.exists():
        return True, f"Found local raw cache at {raw_local_file}"

    api_key = os.getenv("CYBERSHIELD_PHISHTANK_API_KEY", "").strip()
    if api_key:
        return True, "API key configured in environment"

    return False, (
        "PhishTank bulk downloads require an application key registered with Cisco Talos. "
        "No key is available in the environment (.env contains only Google Safe Browsing key). "
        "Per strict safety rules, live PhishTank download is skipped."
    )


def ingest_phishtank_records(
    records_data: List[Dict],
    limit: int = MAX_PHISHING_RECORDS,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse PhishTank JSON records into standardized schema.
    Strictly accepts only records with verified == 'yes' and online == 'yes'.
    Returns: (accepted_records, quarantined_records)
    """
    accepted = []
    quarantined = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for idx, item in enumerate(records_data, start=1):
        if not isinstance(item, dict):
            quarantined.append({
                "record_id": f"phishtank:malformed:{idx}",
                "source": "phishtank",
                "source_record_id": str(idx),
                "source_snapshot": PHISHTANK_SNAPSHOT,
                "acquired_at": now_iso,
                "raw_url": str(item),
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
                "quarantine_reason": "INVALID_JSON_OBJECT",
            })
            continue

        phish_id = str(item.get("phish_id") or idx)
        raw_url = str(item.get("url") or "").strip()
        verified = str(item.get("verified") or "").strip().lower()
        online = str(item.get("online") or "").strip().lower()
        submission_time = item.get("submission_time")
        verification_time = item.get("verification_time")
        target = item.get("target")

        # Strict verification policy: MUST be verified == 'yes'
        if verified != "yes":
            quarantined.append({
                "record_id": f"phishtank:unverified:{phish_id}",
                "source": "phishtank",
                "source_record_id": phish_id,
                "source_snapshot": PHISHTANK_SNAPSHOT,
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
                "quarantine_reason": f"UNVERIFIED_PHISHTANK_RECORD (verified={verified})",
            })
            continue

        # Strict online policy: MUST be online == 'yes'
        if online != "yes":
            quarantined.append({
                "record_id": f"phishtank:offline:{phish_id}",
                "source": "phishtank",
                "source_record_id": phish_id,
                "source_snapshot": PHISHTANK_SNAPSHOT,
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
                "quarantine_reason": f"OFFLINE_PHISHTANK_RECORD (online={online})",
            })
            continue

        # Canonicalize URL
        norm = normalize_url(raw_url)
        if not norm.is_valid:
            quarantined.append({
                "record_id": f"phishtank:invalid:{phish_id}",
                "source": "phishtank",
                "source_record_id": phish_id,
                "source_snapshot": PHISHTANK_SNAPSHOT,
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

        rec_id = f"phishtank:{phish_id}:{hashlib.sha256(norm.normalized_url.encode('utf-8')).hexdigest()[:12]}"

        record = {
            "record_id": rec_id,
            "source": "phishtank",
            "source_record_id": phish_id,
            "source_snapshot": PHISHTANK_SNAPSHOT,
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
            "verification_status": "phishtank_community_verified",
            "original_data_type": "full_url",
            "split": None,
            "quarantine_reason": None,
            "_metadata": {
                "submission_time": submission_time,
                "verification_time": verification_time,
                "target": target,
            },
        }
        accepted.append(record)

        if len(accepted) >= limit:
            break

    return accepted, quarantined
